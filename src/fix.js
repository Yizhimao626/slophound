import fs from 'node:fs';
import { slopHits } from './rules/slop-comments.js';

// --fix only removes whole comment lines that are pure slop (the code part of
// the line must be empty), so a fix can never change program behavior.

export function computeFixable(files) {
  const plan = [];
  for (const f of files) {
    const hits = slopHits(f.comments).filter((h) => {
      const rawLine = f.lines[h.line - 1] ?? '';
      return rawLine.slice(0, h.col ?? rawLine.length).trim() === '';
    });
    if (hits.length === 0) continue;
    const lines = [...new Set(hits.map((h) => h.line))].sort((a, b) => a - b);
    plan.push({ file: f, lines });
  }
  return plan;
}

function applyDeletions(content, lineNums) {
  const set = new Set(lineNums);
  const out = [];
  let removed = 0;
  content.split('\n').forEach((l, i) => {
    if (set.has(i + 1)) {
      removed++;
      return;
    }
    out.push(l);
  });
  return { content: out.join('\n'), removed };
}

export function runFix(files, opts) {
  const plan = computeFixable(files);
  const dry = opts.fixDry;
  let totalRemoved = 0;
  let filesTouched = 0;

  if (plan.length === 0) {
    console.log(dry ? 'Nothing to fix.' : 'Nothing to fix.');
    return 0;
  }

  for (const { file, lines } of plan) {
    const raw = fs.readFileSync(file.path, 'utf8');
    // Preserve the file's own line endings: --fix must never rewrite EOLs
    // across the whole file (CRLF repos would otherwise diff every line).
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const { content, removed } = applyDeletions(raw.replace(/\r\n/g, '\n'), lines);
    totalRemoved += removed;
    filesTouched++;
    if (dry) {
      console.log(`\n${file.rel} — would remove ${removed} comment line(s):`);
      for (const n of lines) console.log(`  - ${n}: ${(file.lines[n - 1] ?? '').trim()}`);
    } else {
      fs.writeFileSync(file.path, eol === '\r\n' ? content.replace(/\n/g, '\r\n') : content);
      console.log(`fixed ${file.rel} — removed ${removed} comment line(s)`);
    }
  }

  console.log(
    dry
      ? `\nDry run: ${totalRemoved} line(s) in ${filesTouched} file(s) would be removed. Re-run with --fix to apply.`
      : `\nDone: removed ${totalRemoved} slop comment line(s) from ${filesTouched} file(s). Re-run slophound to see the new score.`
  );
  return 0;
}
