import { snippetAt } from '../util.js';

const TODO_RE = /\b(?:TODO|FIXME|HACK|XXX)\b/;
const THRESHOLD = 5;

export default {
  id: 'todo-sprawl',
  name: 'TODO sprawl',
  description: 'Files accumulating 5+ TODO/FIXME/HACK markers — unfinished business left behind.',
  defaultSeverity: 'minor',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const findings = [];
    for (const f of files) {
      const hits = [];
      for (const cm of f.comments) {
        if (cm.kind === 'docstring') continue;
        if (TODO_RE.test(cm.text)) {
          for (let l = cm.line; l <= (cm.endLine ?? cm.line); l++) hits.push(l);
        }
      }
      if (hits.length >= THRESHOLD) {
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line: hits[0],
          message: `${hits.length} TODO/FIXME/HACK markers left in this file`,
          snippet: snippetAt(f.lines, hits[0]),
        });
      }
    }
    return findings;
  },
};
