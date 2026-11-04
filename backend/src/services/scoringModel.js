// Scoring "model" for the MAANAS Mind Check.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ML HOOK: this file is the single place the future ML model plugs in.    │
// │ Replace `rulesModel` with an object exposing the same                    │
// │   { version, predict(input) → AssessmentResult }                         │
// │ interface (e.g. one that POSTs `input` to a Python/FastAPI service).    │
// │ Every stored assessment records `model_version`, so results from the    │
// │ rules engine and from later ML versions stay distinguishable.           │
// └──────────────────────────────────────────────────────────────────────────┘

import { SECTIONS, SAFETY_ITEM } from './questionBank.js';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function bandFor(strain) {
  if (strain < 0.25) return 'low';
  if (strain < 0.5) return 'mild';
  if (strain < 0.75) return 'moderate';
  return 'high';
}

function overallBandFor(index) {
  if (index >= 75) return 'Thriving';
  if (index >= 55) return 'Managing';
  if (index >= 35) return 'Struggling';
  return 'Needs support';
}

/** Converts the Stroop-style focus task into a 0..1 strain value. */
export function focusTaskStrain(task) {
  if (!task || !task.trials) return null;
  const accuracy = clamp01(task.correct / task.trials);
  // ~700 ms is a comfortable response; 2000 ms+ counts as fully slowed.
  const slowness = clamp01((task.avgReactionMs - 700) / 1300);
  return clamp01((1 - accuracy) * 0.6 + slowness * 0.4);
}

export const rulesModel = {
  version: 'rules-v1',

  /**
   * @param {{answers: Record<string, number>, focusTask?: {trials:number, correct:number, avgReactionMs:number}}} input
   */
  predict({ answers, focusTask }) {
    const sections = SECTIONS.map((section) => {
      const answered = section.items.filter((item) => Number.isInteger(answers[item.id]));
      const raw = answered.reduce((sum, item) => sum + answers[item.id], 0);
      const max = answered.length * 3;
      let strain = max ? raw / max : 0;

      let taskStrain = null;
      if (section.key === 'focus') {
        taskStrain = focusTaskStrain(focusTask);
        if (taskStrain !== null) strain = answered.length ? strain * 0.7 + taskStrain * 0.3 : taskStrain;
      }

      return {
        key: section.key,
        title: section.title,
        answered: answered.length,
        total: section.items.length,
        raw,
        max,
        strain: Math.round(strain * 100) / 100,
        band: bandFor(strain),
        weight: section.weight,
        ...(taskStrain !== null ? { taskStrain: Math.round(taskStrain * 100) / 100 } : {}),
      };
    });

    const scored = sections.filter((s) => s.answered > 0 || s.taskStrain !== undefined);
    const weightSum = scored.reduce((sum, s) => sum + s.weight, 0);
    const weightedStrain = weightSum ? scored.reduce((sum, s) => sum + s.strain * s.weight, 0) / weightSum : 0;
    const wellbeingIndex = Math.round(100 * (1 - weightedStrain));

    // Recommend specialities for areas showing at least "moderate" strain, worst first.
    let recommended = scored
      .filter((s) => s.strain >= 0.5)
      .sort((a, b) => b.strain - a.strain)
      .map((s) => s.key);
    if (!recommended.length) {
      const top = [...scored].sort((a, b) => b.strain - a.strain)[0];
      if (top && top.strain >= 0.34) recommended = [top.key];
    }

    const crisisFlag = Number(answers[SAFETY_ITEM.id]) > 0;
    const suggestTherapist = crisisFlag || wellbeingIndex < 55 || scored.some((s) => s.band === 'high');

    return {
      modelVersion: this.version,
      sections,
      wellbeingIndex,
      overallBand: overallBandFor(wellbeingIndex),
      recommended: recommended.slice(0, 3),
      crisisFlag,
      suggestTherapist,
    };
  },
};

// Swap this export to plug in the ML model.
export const activeModel = rulesModel;
