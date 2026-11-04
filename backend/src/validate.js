import { badRequest } from './errors.js';

/**
 * Tiny schema validator (keeps the prototype dependency-free).
 * rules: { field: { type, required, min, max, enum, pattern, trim } }
 */
export function validate(body, rules) {
  const out = {};
  const problems = {};
  const input = body && typeof body === 'object' ? body : {};

  for (const [field, rule] of Object.entries(rules)) {
    let value = input[field];
    if (typeof value === 'string' && rule.trim !== false) value = value.trim();
    const missing = value === undefined || value === null || value === '';

    if (missing) {
      if (rule.required) problems[field] = 'is required';
      else if (rule.default !== undefined) out[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') { problems[field] = 'must be text'; continue; }
        if (rule.min && value.length < rule.min) { problems[field] = `must be at least ${rule.min} characters`; continue; }
        if (rule.max && value.length > rule.max) { problems[field] = `must be at most ${rule.max} characters`; continue; }
        break;
      case 'int':
        value = Number(value);
        if (!Number.isInteger(value)) { problems[field] = 'must be a whole number'; continue; }
        if (rule.min !== undefined && value < rule.min) { problems[field] = `must be ≥ ${rule.min}`; continue; }
        if (rule.max !== undefined && value > rule.max) { problems[field] = `must be ≤ ${rule.max}`; continue; }
        break;
      case 'bool':
        value = value === true || value === 'true' || value === 1;
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) { problems[field] = 'must be an object'; continue; }
        break;
      case 'array':
        if (!Array.isArray(value)) { problems[field] = 'must be a list'; continue; }
        if (rule.max && value.length > rule.max) { problems[field] = `must have at most ${rule.max} items`; continue; }
        break;
      default:
        break;
    }
    if (rule.enum && !rule.enum.includes(value)) { problems[field] = `must be one of: ${rule.enum.join(', ')}`; continue; }
    if (rule.pattern && !rule.pattern.test(String(value))) { problems[field] = rule.patternMessage || 'has an invalid format'; continue; }
    out[field] = value;
  }

  if (Object.keys(problems).length) {
    const first = Object.entries(problems)[0];
    throw badRequest(`${first[0]} ${first[1]}`, problems);
  }
  return out;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
