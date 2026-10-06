import { snippetAt } from '../util.js';

const PATTERNS = [
  [/\bfor brevity\b/i, '"for brevity" placeholder'],
  [/\bleft (?:as an exercise|blank|intentionally (?:blank|incomplete))/i, '"left as an exercise" placeholder'],
  [/\bomitted (?:for|from)\b/i, '"omitted" placeholder'],
  [/\brest of (?:the|your) (?:code|implementation|logic) (?:remains|stays|goes|is|unchanged)/i, '"rest of the code" placeholder'],
  [/\bimplementation (?:goes here|omitted|elided|left|pending|not shown)\b/i, '"implementation goes here" placeholder'],
  [/\b(?:your|the|actual|real) (?:code|logic|implementation) here\b/i, '"your code here" placeholder'],
  [/\bsame as (?:above|before|previous)\b/i, '"same as above" placeholder'],
  [/\bremains? (?:the same|unchanged|as before)\b/i, '"remains unchanged" placeholder'],
  [/\bno changes? (?:needed|required|yet)\b/i, '"no changes needed" placeholder'],
  [/\bto be implemented\b/i, '"to be implemented" placeholder'],
  [/\bplaceholder (?:implementation|code|logic)\b/i, 'placeholder implementation'],
  [/\bstub(?:bed)? (?:out|implementation|version)\b/i, 'stubbed implementation'],
  [/\b(?:fill|populate) (?:this|it) (?:in|out)\b/i, '"fill this in" placeholder'],
  [/在此处(?:实现|填写|补充)|代码略|实现略|待实现|待补充|此处省略|同上，?此处略/u, '中文占位注释'],
];

const NOT_IMPLEMENTED_RE =
  /throw new (?:Error|Exception|NotImplementedError)\s*\(\s*[`'"][^`'"]*(?:not implemented|unimplemented|todo)/i;

// Language-native stub markers that live in code (not comments).
const CODE_STUBS = {
  js: [[NOT_IMPLEMENTED_RE, 'info', 'explicit "not implemented" throw']],
  py: [
    [/^\s*\.\.\.\s*$/, 'major', 'stub body ("...") — this function does nothing'],
    [/throw NotImplementedError\s*\(\s*['"][^'"]*(?:not implemented|todo)/i, 'info', 'explicit "not implemented" raise'],
  ],
  go: [[/panic\s*\(\s*["'`][^"'`]*(?:not implemented|unimplemented|todo)/i, 'info', 'explicit "not implemented" panic']],
  java: [[/throw new UnsupportedOperationException\s*\(/, 'info', 'UnsupportedOperationException stub']],
  rust: [[/\b(?:unimplemented|todo)!\s*\(/, 'major', 'unimplemented!/todo!() stub']],
  csharp: [[/throw new NotImplementedException\s*\(/, 'info', 'NotImplementedException stub']],
  kotlin: [[/\bTODO\s*\(\s*(?:["'`]|$)/, 'major', 'Kotlin TODO() stub — throws when reached']],
};

const CAP_PER_FILE = 10;

export default {
  id: 'placeholder-code',
  name: 'Placeholder / stub code',
  description: 'Stub bodies and "goes here" markers where real code should be.',
  defaultSeverity: 'minor',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const findings = [];
    for (const f of files) {
      // Phrase patterns only apply to comments: matching raw code strings
      // would flag linters' own pattern tables and quoted docs (self-referential noise).
      const commentByLine = new Map();
      for (const cm of f.comments) {
        if (cm.kind === 'docstring') continue;
        for (let l = cm.line; l <= (cm.endLine ?? cm.line); l++) {
          commentByLine.set(l, (commentByLine.get(l) ?? '') + ' ' + cm.text);
        }
      }
      const codeStubs = CODE_STUBS[f.lang] ?? [];
      let count = 0;
      for (let i = 0; i < f.lines.length; i++) {
        if (count >= CAP_PER_FILE) break;
        const codeLine = f.maskedLines[i];
        const lineNo = i + 1;
        let matched = false;
        for (const [re, severity, label] of codeStubs) {
          if (re.test(codeLine)) {
            findings.push({
              rule: this.id,
              severity,
              file: f.rel,
              line: lineNo,
              message: label,
              snippet: snippetAt(f.lines, lineNo),
            });
            count++;
            matched = true;
            break;
          }
        }
        if (matched) continue;
        if (count >= CAP_PER_FILE) break;
        const commentText = commentByLine.get(lineNo) ?? '';
        for (const [re, label] of PATTERNS) {
          if (re.test(commentText)) {
            findings.push({
              rule: this.id,
              severity: this.defaultSeverity,
              file: f.rel,
              line: lineNo,
              message: label,
              snippet: snippetAt(f.lines, lineNo),
            });
            count++;
            break;
          }
        }
      }
    }
    return findings;
  },
};
