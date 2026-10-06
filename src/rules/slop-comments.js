import { snippetAt } from '../util.js';

// Curated tell-tale phrases of LLM-written comments. Kept intentionally
// conservative: each phrase alone is only "info"; the rule escalates to
// "minor" when a file accumulates several of them.
const PHRASES = [
  [/\bnote that\b/i, '"Note that"'],
  [/\bit'?s worth noting\b/i, '"it\'s worth noting"'],
  [/\bas you can see\b/i, '"as you can see"'],
  [/\bin (?:summary|conclusion)\b/i, '"in summary"'],
  [/\b(?:importantly|interestingly|notably)\b,/i, '"importantly/notably,"'],
  [/\blet's\b/i, '"let\'s"'],
  [/\bthis (?:function|method|class|line|block|section|component) (?:will|does|is used|handles|creates|returns|sets)/i, '"this function does ..."'],
  [/\bensure(?: that| ing)?\b/i, '"ensure ..."'],
  [/\bmake sure (?:to|that)\b/i, '"make sure to"'],
  [/\bdon'?t forget\b/i, '"don\'t forget"'],
  [/\bstep \d+[:.]/i, '"Step N:"'],
  [/\bcongratulations\b/i, '"congratulations"'],
  [/\bin (?:this|the) (?:example|tutorial|section|guide)\b/i, '"in this example"'],
  [/\bwe (?:will|can) (?:now|see|use)\b/i, '"we will now ..."'],
  [/\bhere(?:'s| is) (?:what|how|the)\b/i, '"here\'s what ..."'],
  [/如你所见|值得一提的是|综上(?:所述)?|接下来，?我们|让我们|注意，?这里/u, '中文 AI 口头禅'],
];

const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function slopHits(comments) {
  const hits = [];
  for (const cm of comments) {
    if (cm.kind !== 'line') continue;
    let label = null;
    for (const [re, phrase] of PHRASES) {
      if (re.test(cm.text)) {
        label = phrase;
        break;
      }
    }
    const hasEmoji = EMOJI_RE.test(cm.text);
    if (label) hits.push({ line: cm.line, col: cm.col, label, safe: true });
    if (hasEmoji && !label) hits.push({ line: cm.line, col: cm.col, label: 'emoji in comment', safe: true });
  }
  return hits;
}

export default {
  id: 'slop-comments',
  name: 'AI-flavored comments',
  description: 'LLM filler phrases and emoji headers in comments ("Note that...", "Let\'s...", 🚀).',
  defaultSeverity: 'info',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const findings = [];
    for (const f of files) {
      const hits = slopHits(f.comments);
      if (hits.length === 0) continue;
      const byLabel = new Map();
      for (const h of hits) byLabel.set(h.label, (byLabel.get(h.label) ?? 0) + 1);
      const top = [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const detail = top.map(([label, n]) => (n > 1 ? `${label}×${n}` : label)).join(', ');
      const severity = hits.length >= 6 ? 'minor' : this.defaultSeverity;
      findings.push({
        rule: this.id,
        severity,
        file: f.rel,
        line: hits[0].line,
        message: `${hits.length} AI-flavored comment${hits.length > 1 ? 's' : ''}: ${detail}`,
        snippet: snippetAt(f.lines, hits[0].line),
      });
    }
    return findings;
  },
};
