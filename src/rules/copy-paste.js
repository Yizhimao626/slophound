import { djb2 } from '../util.js';

const K = 8; // window size in normalized lines
const MIN_GAP = 4; // dedupe overlapping windows within one copy
const MAX_GROUP = 30; // larger groups are treated as boilerplate, not slop
const MAX_FINDINGS = 10;

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim();
}

const STRUCTURE_RE = /[=({[]|\bdef\s|\bfunction\s|\breturn\b|\bclass\s|\bif\b|\bfor\b/;

export default {
  id: 'copy-paste',
  name: 'Copy-pasted blocks',
  description: 'Identical 8-line code blocks repeated across the repo.',
  defaultSeverity: 'major',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const map = new Map();
    for (const f of files) {
      const pairs = [];
      f.maskedLines.forEach((l, i) => {
        const n = normalize(l);
        if (n) pairs.push([n, i + 1]);
      });
      if (pairs.length < K) continue;
      const hs = pairs.map((p) => djb2(p[0]));
      for (let i = 0; i + K <= hs.length; i++) {
        const joined = pairs.slice(i, i + K).map((p) => p[0]).join(' ');
        if (!STRUCTURE_RE.test(joined)) continue;
        let key = '';
        for (let j = 0; j < K; j++) key += hs[i + j] + '.';
        const arr = map.get(key) ?? [];
        arr.push({ file: f.rel, line: pairs[i][1], sample: pairs[i][0] });
        map.set(key, arr);
      }
    }

    const findings = [];
    for (const locs of map.values()) {
      if (locs.length < 2) continue;
      locs.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
      const dedup = [];
      for (const loc of locs) {
        const prev = dedup[dedup.length - 1];
        if (prev && prev.file === loc.file && loc.line - prev.line < MIN_GAP) continue;
        dedup.push(loc);
      }
      if (dedup.length < 2 || dedup.length > MAX_GROUP) continue;
      const where = dedup.slice(0, 4).map((l) => `${l.file}:${l.line}`).join(', ');
      findings.push({
        rule: this.id,
        severity: this.defaultSeverity,
        file: dedup[0].file,
        line: dedup[0].line,
        message: `identical ${K}-line block appears ${dedup.length} times (${where})`,
        snippet: dedup[0].sample.slice(0, 140),
      });
      if (findings.length >= MAX_FINDINGS) break;
    }
    // Overlapping windows (shifted by one line) surface as separate groups;
    // keep only the first report per file within a few lines.
    const kept = [];
    for (const fd of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      const prev = kept[kept.length - 1];
      if (prev && prev.file === fd.file && fd.line - prev.line < 3) continue;
      kept.push(fd);
    }
    return kept;
  },
};
