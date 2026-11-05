import { Router } from 'express';
import { db, json } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { badRequest, handle, notFound } from '../errors.js';
import { validate } from '../validate.js';
import { CRISIS_RESOURCES, SAFETY_ITEM, SCALE, SECTIONS, SPECIALITIES, ALL_ITEM_IDS } from '../services/questionBank.js';
import { activeModel } from '../services/scoringModel.js';

const router = Router();
const MIN_ANSWERS = 8;

export function toAssessment(row) {
  if (!row) return null;
  const recommended = json.parse(row.recommended, []);
  return {
    id: row.id,
    createdAt: row.created_at,
    wellbeingIndex: row.wellbeing_index,
    overallBand: row.overall_band,
    sections: json.parse(row.scores, []),
    recommended,
    recommendedLabels: recommended.map((k) => SPECIALITIES[k] || k),
    crisisFlag: !!row.crisis_flag,
    focusTask: json.parse(row.focus_task, null),
    modelVersion: row.model_version,
  };
}

router.get('/questions', (_req, res) => {
  res.json({
    scale: SCALE,
    timeframe: 'Answer as honestly as you can — there are no right or wrong choices.',
    sections: SECTIONS.map(({ key, title, intro, items }) => ({ key, title, intro, items })),
    safetyItem: SAFETY_ITEM,
    minAnswers: MIN_ANSWERS,
  });
});

router.use(requireAuth, requireRole('user'));

router.post('/', handle((req, res) => {
  const body = validate(req.body, {
    answers: { type: 'object', required: true },
    focusTask: { type: 'object' },
  });

  const answers = {};
  for (const [id, value] of Object.entries(body.answers)) {
    if (!ALL_ITEM_IDS.includes(id)) continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 3) throw badRequest(`Answer for ${id} must be between 0 and 3.`);
    answers[id] = n;
  }
  const scoredCount = Object.keys(answers).filter((id) => id !== SAFETY_ITEM.id).length;
  if (scoredCount < MIN_ANSWERS) throw badRequest(`Please answer at least ${MIN_ANSWERS} questions so the summary is meaningful.`);

  let focusTask = null;
  if (body.focusTask) {
    const f = validate(body.focusTask, {
      trials: { type: 'int', required: true, min: 1, max: 50 },
      correct: { type: 'int', required: true, min: 0, max: 50 },
      avgReactionMs: { type: 'int', required: true, min: 100, max: 20000 },
    });
    if (f.correct > f.trials) throw badRequest('focusTask.correct cannot exceed trials.');
    focusTask = f;
  }

  const result = activeModel.predict({ answers, focusTask });
  const info = db.prepare(`
    INSERT INTO assessments (user_id, answers, focus_task, scores, wellbeing_index, overall_band, recommended, crisis_flag, model_version)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    JSON.stringify(answers),
    focusTask ? JSON.stringify(focusTask) : null,
    JSON.stringify(result.sections),
    result.wellbeingIndex,
    result.overallBand,
    JSON.stringify(result.recommended),
    result.crisisFlag ? 1 : 0,
    result.modelVersion,
  );

  const saved = toAssessment(db.prepare('SELECT * FROM assessments WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json({
    assessment: saved,
    suggestTherapist: result.suggestTherapist,
    crisisResources: result.crisisFlag ? CRISIS_RESOURCES : [],
  });
}));

router.get('/', handle((req, res) => {
  const rows = db.prepare('SELECT * FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({ assessments: rows.map(toAssessment) });
}));

router.get('/:id', handle((req, res) => {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!row) throw notFound('Assessment not found.');
  res.json({ assessment: toAssessment(row), crisisResources: row.crisis_flag ? CRISIS_RESOURCES : [] });
}));

export default router;
