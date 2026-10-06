import fs from 'node:fs';
import path from 'node:path';
import { globToRegex } from './util.js';

const DEFAULT_DIR_IGNORES = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.next',
  '.nuxt', '.cache', '.venv', 'venv', 'env', '__pycache__', '.pytest_cache',
  '.idea', '.vscode', 'vendor', 'target', '.tox', '.mypy_cache', '.ruff_cache',
]);

const SCANNED_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.java', '.rs', '.cs', '.kt',
]);

const LANG_BY_EXT = {
  '.js': 'js', '.jsx': 'js', '.ts': 'js', '.tsx': 'js', '.mjs': 'js', '.cjs': 'js',
  '.py': 'py',
  '.go': 'go',
  '.java': 'java',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.kt': 'kotlin',
};

function readGitignore(root) {
  const matchers = [];
  try {
    const p = path.join(root, '.gitignore');
    if (fs.existsSync(p)) {
      for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = globToRegex(line);
        if (m) matchers.push(m);
      }
    }
  } catch {
    // an unreadable .gitignore should never break the scan
  }
  return matchers;
}

function isBinaryFile(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(1024);
    const n = fs.readSync(fd, buf, 0, 1024, 0);
    fs.closeSync(fd);
    return buf.subarray(0, n).includes(0);
  } catch {
    return true;
  }
}

export function walk(root, options = {}) {
  const maxFiles = options.maxFiles ?? 5000;
  const maxFileSize = options.maxFileSize ?? 512 * 1024;
  const matchers = readGitignore(root);
  for (const g of options.extraIgnore ?? []) {
    const m = globToRegex(g);
    if (m) matchers.push(m);
  }
  const ignored = (rel, isDir) => {
    const probe = isDir ? rel + '/' : rel;
    let hit = false;
    for (const m of matchers) {
      if (m.test(probe) || m.test(rel)) hit = !m.negated;
    }
    return hit;
  };

  const files = [];
  const skipped = { dirs: 0, files: 0 };
  let truncated = false;

  const visit = (dir, depth) => {
    if (truncated || depth > 24) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (truncated) return;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (DEFAULT_DIR_IGNORES.has(e.name) || ignored(rel, true)) {
          skipped.dirs++;
          continue;
        }
        visit(full, depth + 1);
      } else if (e.isFile()) {
        if (ignored(rel, false)) {
          skipped.files++;
          continue;
        }
        const ext = path.extname(e.name).toLowerCase();
        if (!SCANNED_EXTS.has(ext)) continue;
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        if (st.size > maxFileSize || isBinaryFile(full)) {
          skipped.files++;
          continue;
        }
        files.push({
          path: full,
          rel,
          ext,
          lang: LANG_BY_EXT[ext],
          family: LANG_BY_EXT[ext] === 'py' ? 'py' : 'jslike',
        });
        if (files.length >= maxFiles) truncated = true;
      }
    }
  };

  visit(root, 0);
  return { files, skipped, truncated };
}

// Masking is always length- and newline-preserving, so any index computed on
// masked code maps 1:1 onto the original text (line numbers, snippets).
// All input is CRLF-normalized to "\n" before masking.
function blank(m) {
  return m.replace(/[^\n\r]/g, ' ');
}

function lineOfIn(str, idx) {
  let l = 1;
  for (let i = 0; i < idx && i < str.length; i++) {
    if (str.charCodeAt(i) === 10) l++;
  }
  return l;
}

function extractLineComments(masked, lang) {
  const comments = [];
  const out = [];
  let line = 1;
  let start = 0;
  // Rust uses apostrophes for lifetimes and raw strings for quotes, so only
  // double quotes delimit strings there; other C-family languages have both.
  const quoteChars = lang === 'rust' ? ['"'] : ['"', "'"];
  for (let i = 0; i <= masked.length; i++) {
    if (i < masked.length && masked.charCodeAt(i) !== 10) continue;
    const lineText = masked.slice(start, i);
    let inStr = null;
    let cut = -1;
    for (let j = 0; j < lineText.length; j++) {
      const ch = lineText[j];
      if (inStr) {
        if (ch === '\\') j++;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (quoteChars.includes(ch) || (lang === 'js' && ch === '`')) {
        inStr = ch;
        continue;
      }
      if (lang === 'py') {
        if (ch === '#') {
          cut = j;
          break;
        }
      } else if (ch === '/' && lineText[j + 1] === '/') {
        cut = j;
        break;
      }
    }
    if (cut >= 0) {
      const text = lineText.slice(cut).replace(/^\/+|^#+/, '').trim();
      if (text) comments.push({ kind: 'line', line, col: cut, text });
      out.push(masked.slice(start, start + cut) + ' '.repeat(lineText.length - cut));
    } else {
      out.push(lineText);
    }
    line++;
    start = i + 1;
  }
  return { comments, masked: out.join('\n') };
}

export function extractComments(code, f) {
  const comments = [];
  const lang = f.lang;
  let masked = code;
  if (lang === 'py') {
    masked = masked.replace(/"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3}/g, (m, off) => {
      comments.push({ kind: 'docstring', line: lineOfIn(code, off), text: m, endLine: lineOfIn(code, off + m.length - 1) });
      return blank(m);
    });
  } else {
    if (lang === 'java' || lang === 'csharp' || lang === 'kotlin') {
      masked = masked.replace(/"{3}[\s\S]*?"{3}/g, (m) => blank(m));
    }
    if (lang === 'rust') {
      masked = masked.replace(/r(#*)"[\s\S]*?"\1/g, (m) => blank(m));
    }
    if (lang === 'csharp') {
      masked = masked.replace(/@"(?:[^"]|"")*"/g, (m) => blank(m));
    }
    if (lang === 'js' || lang === 'go') {
      masked = masked.replace(/`(?:[^`\\]|\\[\s\S])*`/g, (m) => blank(m));
    }
    masked = masked.replace(/\/\*[\s\S]*?\*\//g, (m, off) => {
      comments.push({ kind: 'block', line: lineOfIn(masked, off), text: m, endLine: lineOfIn(masked, off + m.length - 1) });
      return blank(m);
    });
  }
  const res = extractLineComments(masked, lang);
  comments.push(...res.comments);
  return { comments, masked: res.masked };
}

export function loadFile(f) {
  let raw;
  try {
    raw = fs.readFileSync(f.path, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
  const { comments, masked } = extractComments(raw, f);
  const lines = raw.split('\n');
  const maskedLines = masked.split('\n');
  return { ...f, raw, lines, masked, maskedLines, comments };
}
