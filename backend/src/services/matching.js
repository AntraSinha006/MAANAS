import { SPECIALITIES } from './questionBank.js';

/**
 * Ranks therapists for a user given the specialities recommended by their
 * latest assessment (ordered most → least important) and preferred language.
 */
export function rankTherapists(therapists, { recommended = [], language } = {}) {
  return therapists
    .map((t) => {
      let score = 0;
      const reasons = [];
      recommended.forEach((key, rank) => {
        if (t.specialities.includes(key)) {
          score += 3 - rank; // 3, 2, 1 for the first three recommendations
          reasons.push(`Works with ${SPECIALITIES[key]?.toLowerCase() || key}`);
        }
      });
      if (language && t.languages.includes(language)) {
        score += 1.5;
        reasons.push(`Speaks ${language}`);
      }
      score += Math.min(t.experienceYears, 15) / 15; // small tie-breaker
      return { ...t, matchScore: Math.round(score * 10) / 10, matchReasons: reasons };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
