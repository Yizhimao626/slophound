import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = {
  rules: {
    'no-assert-tests': { enabled: true },
    'placeholder-code': { enabled: true },
    'slop-comments': { enabled: true },
    'comment-ratio': { enabled: true },
    'copy-paste': { enabled: true },
    'broken-imports': { enabled: true },
    'todo-sprawl': { enabled: true },
    'hallucinated-api': { enabled: true },
  },
  ignore: [],
  maxFiles: 5000,
  failOn: 'major',
};

export const CONFIG_FILENAMES = ['slophound.config.json', '.sloprc.json'];

export function loadConfig(root) {
  for (const name of CONFIG_FILENAMES) {
    const p = pathJoin(root, name);
    if (exists(p)) {
      let user;
      try {
        user = JSON.parse(read(p));
      } catch (e) {
        throw new Error(`invalid config file ${name}: ${e.message}`);
      }
      return mergeConfig(DEFAULT_CONFIG, user);
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function mergeConfig(base, user) {
  if (user === null || typeof user !== 'object') return base;
  const out = JSON.parse(JSON.stringify(base));
  if (user.rules && typeof user.rules === 'object') {
    for (const k of Object.keys(user.rules)) {
      out.rules[k] = { ...(out.rules[k] ?? { enabled: true }), ...user.rules[k] };
    }
  }
  if (Array.isArray(user.ignore)) out.ignore.push(...user.ignore);
  if (Number.isFinite(user.maxFiles) && user.maxFiles > 0) out.maxFiles = user.maxFiles;
  if (typeof user.failOn === 'string') out.failOn = user.failOn;
  return out;
}

function pathJoin(a, b) {
  return path.join(a, b);
}
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
function read(p) {
  return fs.readFileSync(p, 'utf8');
}
