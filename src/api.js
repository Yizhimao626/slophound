import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.js';
import { walk, loadFile } from './scanner.js';
import { activeRules } from './rules/index.js';
import { computeScore } from './score.js';
import { summarize } from './report.js';
import { SEVERITY_ORDER, hash64 } from './util.js';

const pkg = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

export const version = pkg.version;

// Findings are fingerprinted by rule+file+message (not line), so a baseline
// survives harmless edits that shift lines around.
export function fingerprint(f) {
  return hash64(`${f.rule}|${f.file}|${f.message}`);
}

export function loadBaseline(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`cannot read baseline file: ${file}`);
  }
  if (!parsed || !Array.isArray(parsed.fingerprints)) {
    throw new Error(`invalid baseline file: ${file} (expected { fingerprints: [...] })`);
  }
  return new Set(parsed.fingerprints);
}

// Programmatic scan API — the single source of truth shared by the CLI,
// the VS Code extension, and library consumers.
// options: { rules?, ignore?, maxFiles?, baseline?, failOn?, target?, onError? }
export function scanPath(root, options = {}) {
  const opts = {
    target: options.target ?? root,
    rules: options.rules ?? null,
    ignore: options.ignore ?? [],
    maxFiles: options.maxFiles ?? null,
    baseline: options.baseline ?? null,
  };
  const config = loadConfig(root);
  if (options.failOn) config.failOn = options.failOn;
  if (opts.maxFiles) config.maxFiles = opts.maxFiles;
  if (opts.ignore.length) config.ignore.push(...opts.ignore);

  // A typo'd failOn (e.g. "Major") must fail loudly — a silently disabled
  // CI gate is the worst possible failure mode for this tool.
  const validFailOn = [...Object.keys(SEVERITY_ORDER), 'none'];
  if (config.failOn && !validFailOn.includes(config.failOn)) {
    throw new Error(`invalid failOn "${config.failOn}" (expected: ${validFailOn.join(' | ')})`);
  }

  const { files, skipped, truncated } = walk(root, { extraIgnore: config.ignore, maxFiles: config.maxFiles });
  const loaded = files.map(loadFile).filter(Boolean);

  const rules = activeRules(config, opts.rules);
  const findings = [];
  for (const rule of rules) {
    const subset = loaded.filter((f) => rule.languages.includes(f.lang));
    if (subset.length === 0) continue;
    try {
      findings.push(...rule.run(subset, { root, config }));
    } catch (e) {
      if (options.onError) options.onError(`rule ${rule.id} failed: ${e.message}`);
    }
  }
  for (const fd of findings) {
    const override = config.rules[fd.rule]?.severity;
    if (override) fd.severity = override;
  }
  if (opts.baseline) {
    const seen = loadBaseline(opts.baseline);
    for (const fd of findings) {
      if (seen.has(fingerprint(fd))) fd.baseline = true;
    }
  }
  const active = findings.filter((fd) => !fd.baseline);
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  );

  const totalLines = loaded.reduce((s, f) => s + f.lines.filter((l) => l.trim()).length, 0);
  const { score, grade } = computeScore(active, totalLines);

  const result = {
    tool: 'slophound',
    version: pkg.version,
    target: opts.target,
    scannedAt: new Date().toISOString(),
    files: loaded.length,
    skippedDirs: skipped.dirs,
    skippedFiles: skipped.files,
    truncated,
    lines: totalLines,
    rulesRun: rules.length,
    score,
    grade,
    baselineCount: findings.length - active.length,
    findings,
    summary: summarize(active),
  };
  return { config, active, result, loaded };
}
