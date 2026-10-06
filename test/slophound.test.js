import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from '../src/cli.js';
import { scanPath, fingerprint } from '../src/api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLOPPY = path.join(ROOT, 'test', 'fixtures', 'sloppy-project');
const CLEAN = path.join(ROOT, 'test', 'fixtures', 'clean-project');
const SRCLAYOUT = path.join(ROOT, 'test', 'fixtures', 'src-layout-project');

// Runs the CLI in-process and captures console output.
function run(args) {
  const logs = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  let code;
  try {
    code = main([...args, '--no-color']);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { status: code, stdout: logs.join('\n') };
}

function runJson(args) {
  const r = run([...args, '--json']);
  return JSON.parse(r.stdout);
}

test('sloppy project: every core rule fires and CI gate fails', () => {
  const r = run([SLOPPY, '--json']);
  assert.equal(r.status, 1, `expected exit 1, output: ${r.stdout}`);
  const res = JSON.parse(r.stdout);
  const ids = new Set(res.findings.map((f) => f.rule));
  for (const id of ['no-assert-tests', 'placeholder-code', 'slop-comments', 'copy-paste', 'broken-imports', 'todo-sprawl', 'hallucinated-api']) {
    assert.ok(ids.has(id), `expected rule ${id} to fire`);
  }
  // Regression guard: relative imports must actually be resolved (a regex in
  // SKIP_SPEC_RE once silently disabled this entire branch, see v0.4.1).
  assert.ok(
    res.findings.some((f) => f.rule === 'broken-imports' && f.message.includes('does-not-exist.js')),
    'relative import ./does-not-exist.js must be flagged'
  );
  assert.ok(res.score < 90, `expected a low score, got ${res.score}`);
  assert.ok(res.files >= 10, 'expected at least 10 scanned files');
});

test('hallucinated-api: flags fake members on Math/JSON/os, not real ones', () => {
  const res = runJson([SLOPPY]);
  const hits = res.findings.filter((f) => f.rule === 'hallucinated-api');
  const messages = hits.map((f) => f.message).join('\n');
  assert.ok(messages.includes('JSON.isValid'), `expected JSON.isValid flagged: ${messages}`);
  assert.ok(messages.includes('Math.mean'), `expected Math.mean flagged: ${messages}`);
  assert.ok(messages.includes('os.listdirs'), `expected os.listdirs flagged: ${messages}`);
  for (const real of ['Math.max', 'console.log', 'os.getcwd']) {
    assert.ok(!messages.includes(real), `${real} must not be flagged`);
  }
});

test('hallucinated-api: literal receivers checked (fake flagged, real not)', () => {
  const res = runJson([SLOPPY]);
  const messages = res.findings
    .filter((f) => f.rule === 'hallucinated-api')
    .map((f) => f.message)
    .join('\n');
  assert.ok(messages.includes('toUpper'), `expected "report".toUpper() flagged: ${messages}`);
  assert.ok(messages.includes('strips'), `expected "slop".strips() flagged: ${messages}`);
  assert.ok(!/\.trim\(\) — no such/.test(messages), 'trim() must not be flagged');
  assert.ok(!/\bname\b.*no such/.test(messages), 'upper() must not be flagged');
  assert.ok(!messages.includes('array literal'), 'element access like x[0].trim() must not be flagged');
});

test('--prune-baseline drops fingerprints that no longer occur', () => {
  const baselineFile = path.join(ROOT, 'test', 'tmp-prune.json');
  run([SLOPPY, '--update-baseline', baselineFile]);
  const seeded = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  assert.ok(seeded.fingerprints.length > 0, 'seeded baseline must be non-empty');

  const r = run([CLEAN, '--prune-baseline', baselineFile]);
  assert.equal(r.status, 0, `prune run failed: ${r.stdout}`);
  assert.ok(/pruned|up to date/.test(r.stdout), `unexpected output: ${r.stdout}`);

  const prunedFile = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  assert.equal(prunedFile.fingerprints.length, 0, 'all seeded fingerprints must be gone');
  fs.unlinkSync(baselineFile);
});

test('multi-language: Go/Java/Rust/C#/Kotlin test files are checked', () => {
  const res = runJson([SLOPPY]);
  for (const file of ['service.go', 'Service.java', 'lib.rs', 'Runner.cs', 'util.kt']) {
    const hits = res.findings.filter((f) => f.rule === 'no-assert-tests' && f.file === file);
    assert.ok(hits.length >= 1, `expected no-assert-tests finding in ${file}`);
  }
  const goStubs = res.findings.filter((f) => f.file === 'service.go' && f.rule === 'placeholder-code');
  assert.ok(goStubs.length >= 1, 'expected a Go panic("not implemented") stub finding');
  const rustStubs = res.findings.filter((f) => f.file === 'lib.rs' && f.rule === 'placeholder-code');
  assert.ok(rustStubs.length >= 1, 'expected a Rust todo!() stub finding');
  const ktStubs = res.findings.filter((f) => f.file === 'util.kt' && f.rule === 'placeholder-code');
  assert.ok(ktStubs.length >= 1, 'expected a Kotlin TODO() stub finding');
});

test('baseline: --update-baseline then --baseline suppresses everything recorded', () => {
  const baselineFile = path.join(ROOT, 'test', 'tmp-baseline.json');
  const write = run([SLOPPY, '--update-baseline', baselineFile]);
  assert.equal(write.status, 0);
  assert.ok(fs.existsSync(baselineFile));

  const without = runJson([SLOPPY]);
  const withBaseline = runJson([SLOPPY, '--baseline', baselineFile]);
  assert.equal(run([SLOPPY, '--baseline', baselineFile]).status, 0, 'baseline run must exit 0');
  assert.ok(withBaseline.baselineCount > 0, 'expected suppressed findings');
  assert.equal(withBaseline.findings.length, without.findings.length, 'all findings still reported');
  assert.ok(withBaseline.score > without.score, 'score must ignore baseline findings');
  fs.unlinkSync(baselineFile);
});

test('sarif: --sarif writes valid SARIF 2.1.0 with matching results', () => {
  const out = path.join(ROOT, 'test', 'tmp-report.sarif.json');
  const res = runJson([SLOPPY, '--sarif', out]);
  assert.ok(fs.existsSync(out));
  const sarif = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].results.length, res.findings.length);
  assert.ok(sarif.runs[0].results.every((r) => r.ruleId && r.locations?.[0]?.physicalLocation?.region?.startLine));
  assert.ok(sarif.runs[0].tool.driver.rules.length >= 1);
  fs.unlinkSync(out);
});

test('--list-rules prints the rule catalog', () => {
  const r = run(['--list-rules']);
  assert.equal(r.status, 0);
  for (const id of ['no-assert-tests', 'todo-sprawl', 'broken-imports']) {
    assert.ok(r.stdout.includes(id), `expected ${id} in catalog`);
  }
});

test('clean project: passes with no minor+ findings and a high score', () => {
  const r = run([CLEAN, '--json']);
  assert.equal(r.status, 0, `expected exit 0, findings: ${r.stdout}`);
  const res = JSON.parse(r.stdout);
  const serious = res.findings.filter((f) => f.severity !== 'info');
  assert.equal(serious.length, 0, `unexpected serious findings: ${JSON.stringify(serious)}`);
  assert.ok(res.score >= 90, `expected score >= 90, got ${res.score}`);
});

test('--fail-on none never fails the build', () => {
  assert.equal(run([SLOPPY, '--fail-on', 'none']).status, 0);
});

test('--rules filter runs only the selected rule', () => {
  const res = runJson([SLOPPY, '--rules', 'copy-paste']);
  assert.ok(res.findings.length >= 1);
  for (const f of res.findings) assert.equal(f.rule, 'copy-paste');
});

test('--ignore excludes matched files', () => {
  const all = runJson([SLOPPY]);
  const fewer = runJson([SLOPPY, '--ignore', '*.py']);
  assert.ok(all.files > fewer.files, `expected fewer files, ${all.files} -> ${fewer.files}`);
  assert.equal(fewer.files, 8);
});

test('programmatic API: scanPath matches CLI output', () => {
  const { result } = scanPath(SLOPPY, { target: SLOPPY });
  const viaCli = runJson([SLOPPY]);
  assert.equal(result.findings.length, viaCli.findings.length);
  assert.equal(result.score, viaCli.score);
  assert.equal(result.files, viaCli.files);
});

test('--md writes a Markdown report', () => {
  const out = path.join(ROOT, 'test', 'tmp-report.md');
  const r = run([CLEAN, '--md', out]);
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(out));
  const content = fs.readFileSync(out, 'utf8');
  assert.ok(content.includes('SlopHound report'));
  assert.ok(content.startsWith('#'));
  fs.unlinkSync(out);
});

test('--fix-dry previews fixes without touching files', () => {
  const target = path.join(SLOPPY, 'app.js');
  const before = fs.readFileSync(target, 'utf8');
  const r = run([SLOPPY, '--fix-dry']);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('would remove'), `unexpected output: ${r.stdout}`);
  assert.equal(fs.readFileSync(target, 'utf8'), before, 'fix-dry must not modify files');
});

test('--fix removes slop comment lines and keeps code intact', () => {
  const copy = path.join(ROOT, 'test', 'tmp-fix-project');
  fs.cpSync(SLOPPY, copy, { recursive: true });
  try {
    const r = run([copy, '--fix']);
    assert.equal(r.status, 0);
    const fixed = fs.readFileSync(path.join(copy, 'app.js'), 'utf8');
    assert.ok(!fixed.includes('Note that'), 'slop comment should be removed');
    assert.ok(!fixed.includes('🚀'), 'emoji comment should be removed');
    assert.ok(fixed.includes('export function main'), 'code must survive the fix');
    assert.ok(fixed.includes('import { magic }'), 'comment-only lines only; code imports stay');
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('self-scan: slophound keeps its own source clean', () => {
  const r = run([path.join(ROOT, 'src'), '--json']);
  assert.equal(r.status, 0, `self-scan found serious issues: ${r.stdout}`);
  const res = JSON.parse(r.stdout);
  const serious = res.findings.filter((f) => f.severity !== 'info');
  assert.equal(serious.length, 0, `unexpected findings in src: ${JSON.stringify(serious)}`);
  assert.ok(res.score >= 90, `expected self-scan score >= 90, got ${res.score}`);
});

test('broken-imports: declared deps are not flagged; ?raw imports resolve', () => {
  const res = runJson([SLOPPY]);
  const messages = res.findings
    .filter((f) => f.rule === 'broken-imports')
    .map((f) => f.message)
    .join('\n');
  assert.ok(!messages.includes('some-package-that-is-not-installed'), 'package declared in package.json must not be flagged');
  assert.ok(!messages.includes('?raw'), 'query-string import must resolve against the base path');
  assert.ok(messages.includes('does-not-exist.js'), 'missing relative import must still be flagged');
});

test('--fail-on with an invalid value fails loudly instead of disabling the gate', () => {
  const r = run([SLOPPY, '--fail-on', 'Major']);
  assert.equal(r.status, 2);
  assert.ok(/invalid failOn/i.test(r.stdout), `unexpected output: ${r.stdout}`);
});

test('--rules with an unknown rule id fails loudly', () => {
  const r = run([SLOPPY, '--rules', 'no-such-rule']);
  assert.equal(r.status, 2);
  assert.ok(/unknown rule/i.test(r.stdout), `unexpected output: ${r.stdout}`);
});

test('missing option values fail with a clear error', () => {
  // --ignore must be last so the helper doesn't append a value for it.
  const logs = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  let code;
  try {
    code = main([SLOPPY, '--ignore']);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assert.equal(code, 2);
  assert.ok(/missing value/i.test(logs.join('\n')), `unexpected output: ${logs.join('\n')}`);
});

test('--fix preserves CRLF line endings', () => {
  const copy = path.join(ROOT, 'test', 'tmp-crlf-project');
  fs.cpSync(SLOPPY, copy, { recursive: true });
  try {
    const target = path.join(copy, 'app.js');
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\n/g, '\r\n'));
    const r = run([copy, '--fix']);
    assert.equal(r.status, 0);
    const after = fs.readFileSync(target, 'utf8');
    assert.ok(after.includes('\r\n'), 'CRLF line endings must survive --fix');
    assert.ok(!after.includes('Note that'), 'slop comment should be removed');
    assert.ok(after.includes('export function main'), 'code must survive the fix');
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('--md marks baseline-suppressed findings', () => {
  const baselineFile = path.join(ROOT, 'test', 'tmp-md-baseline.json');
  const mdFile = path.join(ROOT, 'test', 'tmp-md-report.md');
  run([SLOPPY, '--update-baseline', baselineFile]);
  try {
    const r = run([SLOPPY, '--baseline', baselineFile, '--md', mdFile]);
    assert.equal(r.status, 0);
    const md = fs.readFileSync(mdFile, 'utf8');
    assert.ok(md.includes('*(baseline)*'), `expected baseline markers in report: ${md.slice(0, 600)}`);
  } finally {
    fs.rmSync(baselineFile, { force: true });
    fs.rmSync(mdFile, { force: true });
  }
});

test('--version and --help work', () => {
  assert.match(run(['--version']).stdout, /slophound v/);
  assert.ok(run(['--help']).stdout.includes('Usage'));
});

test('broken-imports: src-layout project does not flag its own package', () => {
  const res = runJson([SRCLAYOUT]);
  const msgs = res.findings
    .filter((f) => f.rule === 'broken-imports')
    .map((f) => f.message)
    .join('\n');
  assert.ok(!msgs.includes('"mypkg"'), `project's own src-layout package must not be flagged: ${msgs}`);
  assert.ok(msgs.includes('not_a_real_module_xyz'), 'hallucinated imports must still be flagged');
});

test('fingerprints: stable, and collision-free for realistic baselines', () => {
  const a = { rule: 'copy-paste', file: 'a.js', message: 'identical 8-line block appears 2 times (a.js:1, b.js:2)' };
  assert.equal(fingerprint(a), fingerprint({ ...a }), 'same finding must produce the same fingerprint');
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(fingerprint({ rule: 'r', file: `f${i}.js`, message: 'm' }));
  assert.equal(seen.size, 5000, 'distinct findings must not collide');
});
