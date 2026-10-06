import { lineOfIndex, snippetAt } from '../util.js';

const JS_ASSERT_RE =
  /\b(expect|assert|should)\b|\bt\.(?:ok|pass|fail|equal|notEqual|deepEqual|deepStrictEqual|strictEqual|notStrictEqual|throws|doesNotThrow|rejects|resolves)\b|\.to\.(?:equal|be|deep|match|have|exist)|should\.|chai\b/i;

const PY_ASSERT_RE =
  /\bassert\b|self\.assert\w+|pytest\.(?:raises|fail|warns)|\.raises\(|unittest\.fail/;

const GO_ASSERT_RE = /\bt\.(?:Error|Errorf|Fatal|Fatalf|Fatalln|Fail|Failed)\b|\b(?:assert|require)\.\w+/;

const JAVA_ASSERT_RE =
  /\bassert\b|Assertions\.|assertThat|assert\w*\s*\(|\bfail\s*\(|\bverify\s*\(|Mockito\./;

const RUST_ASSERT_RE =
  /\bassert(?:_eq|_ne)?!|\.unwrap\(\)|\.expect\(|panic!|matches!/;

const JS_TEST_RE = /(?<![\w$.])(?:test|it)\s*(\.\w+)*\s*\(/g;
const GO_TEST_RE = /func\s+(?:\([^)]*\)\s*)?Test\w+\s*\([^)]*testing\.T\)/g;
const JAVA_TEST_RE = /@(?:\w+\.)?Test\b/g;
const RUST_TEST_RE = /#\[\s*test\b/g;

const CSHARP_TEST_RE = /\[\s*(?:Test|TestMethod|Fact|Theory)\b[^\]]*\]/g;
const CSHARP_ASSERT_RE = /\bAssert\.\w+|\.Should\(|\bShouldly\b|FluentAssertions|\bExpect(?:ed)?\.\w+/;

const KOTLIN_TEST_RE = /@Test\b/g;
const KOTLIN_ASSERT_RE =
  /\bassert(?:Equals|NotEquals|True|False|NotNull|Null|Fails|Throws)?\b|\bAssert\.\w+|\bshouldBe(?:EqualTo)?\b|\bshouldThrow\b|\bexpect\s*\(|\bExpect\.\w+/;

// String-aware masking lets the brace/paren counters treat all contents as
// plain code, without a second hand-rolled string state machine.
const STRING_MASK_RE =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\[\s\S])*`/g;

function maskStrings(code) {
  return code.replace(STRING_MASK_RE, (m) => m.replace(/[^\n\r]/g, ' '));
}

function matchPair(code, openIdx, openCh, closeCh) {
  const end = Math.min(code.length, openIdx + 20000);
  let depth = 0;
  for (let i = openIdx; i < end; i++) {
    const ch = code[i];
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Finds the first '{' within `window` characters of `fromIdx`.
function findBraceBlock(masked, fromIdx, window = 400) {
  const open = masked.indexOf('{', fromIdx);
  if (open === -1 || open - fromIdx > window) return null;
  const close = matchPair(masked, open, '{', '}');
  if (close === -1) return null;
  return [open, close];
}

export default {
  id: 'no-assert-tests',
  name: 'Tests without assertions',
  description: 'Test cases that never assert anything — passing coverage that verifies nothing.',
  defaultSeverity: 'major',
  languages: ['js', 'py', 'go', 'java', 'rust', 'csharp', 'kotlin'],
  run(files) {
    const findings = [];
    for (const f of files) {
      const masked = maskStrings(f.masked);
      switch (f.lang) {
        case 'js':
          this.runJs(f, masked, findings);
          break;
        case 'go':
          this.runGo(f, masked, findings);
          break;
        case 'java':
          this.runAnnotated(f, masked, findings, JAVA_TEST_RE, JAVA_ASSERT_RE, 'JUnit test');
          break;
        case 'kotlin':
          this.runAnnotated(f, masked, findings, KOTLIN_TEST_RE, KOTLIN_ASSERT_RE, 'Kotlin test');
          break;
        case 'csharp':
          this.runAnnotated(f, masked, findings, CSHARP_TEST_RE, CSHARP_ASSERT_RE, 'C# test');
          break;
        case 'rust':
          this.runAnnotated(f, masked, findings, RUST_TEST_RE, RUST_ASSERT_RE, 'Rust test');
          break;
        case 'py':
          this.runPy(f, findings);
          break;
      }
    }
    return findings;
  },

  runJs(f, masked, findings) {
    for (const m of masked.matchAll(JS_TEST_RE)) {
      const modifiers = m[1] ?? '';
      if (/\.skip|\.todo/.test(modifiers)) continue;
      const open = masked.indexOf('(', m.index);
      const close = matchPair(masked, open, '(', ')');
      if (close === -1) continue;
      if (!JS_ASSERT_RE.test(masked.slice(open, close))) {
        const line = lineOfIndex(f.raw, m.index);
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line,
          message: 'test case contains no assertions — it cannot fail',
          snippet: snippetAt(f.lines, line),
        });
      }
    }
  },

  runGo(f, masked, findings) {
    for (const m of masked.matchAll(GO_TEST_RE)) {
      const block = findBraceBlock(masked, m.index);
      if (!block) continue;
      if (!GO_ASSERT_RE.test(masked.slice(block[0], block[1]))) {
        const line = lineOfIndex(f.raw, m.index);
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line,
          message: 'test case contains no assertions — it cannot fail',
          snippet: snippetAt(f.lines, line),
        });
      }
    }
  },

  runAnnotated(f, masked, findings, testRe, assertRe, label) {
    for (const m of masked.matchAll(testRe)) {
      const block = findBraceBlock(masked, m.index);
      if (!block) continue;
      if (!assertRe.test(masked.slice(block[0], block[1]))) {
        const line = lineOfIndex(f.raw, m.index);
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line,
          message: `${label} contains no assertions — it cannot fail`,
          snippet: snippetAt(f.lines, line),
        });
      }
    }
  },

  runPy(f, findings) {
    const lines = f.maskedLines;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)def\s+(test_\w+)\s*\(/);
      if (!m) continue;
      const indent = m[1].length;
      const bodyLines = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.trim() === '') {
          bodyLines.push(l);
          continue;
        }
        if (l.match(/^\s*/)[0].length <= indent) break;
        bodyLines.push(l);
      }
      if (!PY_ASSERT_RE.test(bodyLines.join('\n'))) {
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line: i + 1,
          message: `test ${m[2]} contains no assertions — it cannot fail`,
          snippet: snippetAt(f.lines, i + 1),
        });
      }
    }
  },
};
