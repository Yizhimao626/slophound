export const SEVERITY_ORDER = { info: 0, minor: 1, major: 2, critical: 3 };
export const SEVERITY_WEIGHT = { info: 0.25, minor: 1, major: 3, critical: 8 };

export function lineOfIndex(text, index) {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function snippetAt(lines, lineNo) {
  const l = (lines[lineNo - 1] ?? '').trim();
  return l.length > 140 ? l.slice(0, 137) + '...' : l;
}

export function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// Light gitignore-style glob: supports *, **, ?, leading "/", trailing "/" (dir-only), "!" negation.
export function globToRegex(glob) {
  let s = glob.trim();
  if (!s || s === '/' || s === '!') return null;
  let negated = false;
  if (s.startsWith('!')) {
    negated = true;
    s = s.slice(1);
  }
  let anchored = s.startsWith('/');
  if (anchored) s = s.slice(1);
  const dirOnly = s.endsWith('/');
  if (dirOnly) s = s.slice(0, -1);
  let re = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '*') {
      if (s[i + 1] === '*') {
        re += '.*';
        i++;
        if (s[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  // A pattern containing an inner slash is anchored to the scan root, like gitignore.
  if (!anchored && !s.includes('/')) re = `(^|/)${re}`;
  const body = dirOnly ? `${re}(/|$)` : `${re}$`;
  const rx = new RegExp(anchored ? `^${body}` : body);
  return { test: (p) => rx.test(p), negated };
}

let colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
export function setColorEnabled(v) {
  if (v !== null && v !== undefined) colorEnabled = !!v;
}
export function color(code, s) {
  return colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : String(s);
}
export const c = {
  bold: (s) => color('1', s),
  dim: (s) => color('2', s),
  red: (s) => color('31', s),
  green: (s) => color('32', s),
  yellow: (s) => color('33', s),
  magenta: (s) => color('35', s),
  cyan: (s) => color('36', s),
  gray: (s) => color('90', s),
};

export function severityColor(sev) {
  switch (sev) {
    case 'critical': return c.magenta;
    case 'major': return c.red;
    case 'minor': return c.yellow;
    default: return c.gray;
  }
}
