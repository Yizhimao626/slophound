import { SEVERITY_WEIGHT } from './util.js';

// Transparent formula: start at 100, deduct 8 points per weighted finding per
// 1000 non-blank lines. Weights: info 0.25, minor 1, major 3, critical 8.
const DEDUCTION_PER_KLOC = 8;

export function gradeOf(score) {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}

export function computeScore(findings, totalLines) {
  const kloc = Math.max(totalLines / 1000, 0.5);
  const weight = findings.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 1), 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - (weight / kloc) * DEDUCTION_PER_KLOC)));
  return { score, grade: gradeOf(score) };
}
