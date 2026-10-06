export default {
  id: 'comment-ratio',
  name: 'Comment-heavy files',
  description: 'Files that are more than half comments — a hallmark of over-explained AI output.',
  defaultSeverity: 'minor',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const findings = [];
    for (const f of files) {
      const nonBlank = f.lines.filter((l) => l.trim() !== '').length;
      if (nonBlank < 20) continue;
      let commentLines = 0;
      for (const cm of f.comments) {
        if (cm.kind === 'docstring') continue;
        commentLines += (cm.endLine ?? cm.line) - cm.line + 1;
      }
      const ratio = commentLines / nonBlank;
      if (ratio >= 0.5) {
        const pct = Math.round(ratio * 100);
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line: 1,
          message: `${pct}% of this file is comments (${commentLines} of ${nonBlank} non-blank lines)`,
        });
      }
    }
    return findings;
  },
};
