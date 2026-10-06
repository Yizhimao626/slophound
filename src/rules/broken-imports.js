import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { lineOfIndex, snippetAt } from '../util.js';

const JS_EXTS = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json'];

const STDLIB = new Set(
  ('abc argparse array ast asyncio base64 binascii bisect builtins bz2 calendar cmath cmd ' +
    'collections concurrent configparser contextlib contextvars copy copyreg cProfile csv ctypes ' +
    'dataclasses datetime dbm decimal difflib dis doctest email encodings enum errno faulthandler ' +
    'fileinput fnmatch fractions ftplib functools gc getopt getpass gettext glob gzip hashlib heapq ' +
    'hmac html http idlelib imaplib importlib inspect io ipaddress itertools json keyword linecache ' +
    'locale logging lzma marshal math mimetypes multiprocessing numbers operator os pathlib pdb ' +
    'pickle pickletools pkgutil platform plistlib poplib posixpath pprint profile pstats pty pwd ' +
    'py_compile pyclbr pydoc queue quopri random re readline reprlib resource runpy sched secrets ' +
    'select selectors shelve shlex shutil signal site smtplib socket socketserver sqlite3 ssl stat ' +
    'statistics string stringprep struct subprocess symtable sys sysconfig tarfile tempfile termios ' +
    'textwrap threading time timeit tkinter token tokenize trace traceback tracemalloc tty types ' +
    'typing unicodedata unittest urllib uuid venv warnings wave weakref webbrowser wsgiref xml ' +
    'xmlrpc zipapp zipfile zipimport zlib zoneinfo').split(' ')
);

const normName = (s) => s.toLowerCase().replace(/[._-]+/g, '');

// Packages declared in package.json count as intentional even when not
// installed yet (fresh clone, CI before npm install, workspace deps).
function jsDeclaredDeps(root) {
  const names = new Set();
  try {
    const resolvedRoot = path.resolve(root);
    const manifest = path.join(resolvedRoot, 'package.json'); // fixed filename, no user-controlled segments
    if (!manifest.startsWith(resolvedRoot + path.sep)) return names; // containment guard
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const name of Object.keys(pkg[key] ?? {})) names.add(name);
      }
    }
  } catch {}
  return names;
}

// Bundler suffixes like ?raw / ?inline / #fragment must not break resolution.
const stripQuery = (spec) => spec.replace(/[?#].*$/, '');

function pyDeclaredDeps(root) {  const names = new Set();
  try {
    const req = path.join(root, 'requirements.txt');
    if (fs.existsSync(req)) {
      for (const line of fs.readFileSync(req, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*[A-Za-z0-9][\w.\-]*/);
        if (m) names.add(normName(m[0]));
      }
    }
  } catch {}
  try {
    const pp = path.join(root, 'pyproject.toml');
    if (fs.existsSync(pp)) {
      const t = fs.readFileSync(pp, 'utf8');
      const deps = t.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
      if (deps) {
        for (const m of deps[1].matchAll(/["']([^"']+)["']/g)) {
          const nm = m[1].match(/^\s*[A-Za-z0-9][\w.\-]*/);
          if (nm) names.add(normName(nm[0]));
        }
      }
    }
  } catch {}
  return names;
}

function resolveRelative(baseDir, spec) {
  const p = path.resolve(baseDir, spec);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
  } catch {}
  for (const e of JS_EXTS) {
    try {
      if (fs.existsSync(p + e)) return true;
      if (fs.existsSync(path.join(p, 'index' + e))) return true;
    } catch {}
  }
  return false;
}

function packageInstalled(fromDir, root, pkg) {
  let d = fromDir;
  for (;;) {
    try {
      if (fs.existsSync(path.join(d, 'node_modules', pkg))) return true;
    } catch {}
    if (d === root) return false;
    const parent = path.dirname(d);
    if (parent === d) return false;
    d = parent;
  }
}

// NOTE: no "^\.|" here — relative specifiers are resolved by their own branch
// below; skipping them here would silently disable the whole relative check.
const SKIP_SPEC_RE = /^(node|data|blob|https?):|^#|\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|md|txt|wasm|vue|svelte)$/i;

const addFinding = (findings, rule, severity, file, line, message, snippet) => {
  findings.push({ rule, severity, file, line, message, snippet });
};

export default {
  id: 'broken-imports',
  name: 'Unresolvable imports',
  description:
    'Experimental: relative imports that do not resolve on disk, and packages that are neither installed nor declared. A signal of hallucinated imports.',
  defaultSeverity: 'minor',
  languages: ['js', 'py'],
  run(files, ctx) {
    const findings = [];
    findings.push(...this.runJs(files.filter((f) => f.lang === 'js'), ctx));
    findings.push(...this.runPy(files.filter((f) => f.lang === 'py'), ctx));
    return findings;
  },

  runJs(files, ctx) {
    const findings = [];
    const ignoreList = ctx.config.rules['broken-imports']?.ignore ?? [];
    const aliases = ctx.config.paths ?? {};
    const declared = jsDeclaredDeps(ctx.root);
    const SPEC_RES = [
      /import\s+[^;'"()]*?\bfrom\s*['"]([^'"]+)['"]/g,
      /export\s+[^;'"()]*?\bfrom\s*['"]([^'"]+)['"]/g,
      /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /^\s*import\s*['"]([^'"]+)['"]/gm,
    ];
    for (const f of files) {
      const specs = new Map();
      for (const re of SPEC_RES) {
        for (const m of f.masked.matchAll(re)) {
          if (!specs.has(m[1])) specs.set(m[1], m.index);
        }
      }
      for (const [spec, idx] of specs) {
        if (SKIP_SPEC_RE.test(spec) || spec.startsWith('#')) continue;
        if (spec.startsWith('@/') || spec.startsWith('~/')) continue;
        const line = lineOfIndex(f.raw, idx);
        let aliased = false;
        for (const a of Object.keys(aliases)) {
          if (spec === a || spec.startsWith(a + '/')) {
            aliased = true;
            break;
          }
        }
        if (aliased) continue;

        if (spec.startsWith('./') || spec.startsWith('../')) {
          if (!resolveRelative(path.dirname(f.path), stripQuery(spec))) {
            addFinding(findings, this.id, this.defaultSeverity, f.rel, line, `relative import does not resolve: "${spec}"`, snippetAt(f.lines, line));
          }
          continue;
        }

        const parts = stripQuery(spec).split('/');
        const top = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        if (spec.startsWith('node:') || builtinModules.includes(top)) continue;
        if (ignoreList.includes(top)) continue;
        if (!packageInstalled(path.dirname(f.path), ctx.root, top) && !declared.has(top)) {
          addFinding(
            findings,
            this.id,
            this.defaultSeverity,
            f.rel,
            line,
            `package "${top}" is not installed and not declared in package.json`,
            snippetAt(f.lines, line)
          );
        }
      }
    }
    return findings;
  },

  runPy(files, ctx) {
    const findings = [];
    const deps = pyDeclaredDeps(ctx.root);
    const IMPORT_RE = /^\s*from\s+([\w.]+)\s+import/gm;
    const IMPORT_LINE_RE = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
    for (const f of files) {
      const targets = [];
      for (const m of f.masked.matchAll(IMPORT_RE)) targets.push([m[1], m.index]);
      for (const m of f.masked.matchAll(IMPORT_LINE_RE)) {
        for (const mod of m[1].split(',')) {
          const name = mod.trim().split(/\s+as\s+/)[0].trim();
          if (name) targets.push([name, m.index]);
        }
      }
      for (const [mod, idx] of targets) {
        const top = mod.split('.')[0];
        if (STDLIB.has(top)) continue;
        const localOk = [path.dirname(f.path), ctx.root].some((d) => {
          try {
            return fs.existsSync(path.join(d, top + '.py')) || fs.existsSync(path.join(d, top, '__init__.py'));
          } catch {
            return false;
          }
        });
        if (localOk || deps.has(normName(top))) continue;
        const line = lineOfIndex(f.raw, idx);
        addFinding(
          findings,
          this.id,
          'info',
          f.rel,
          line,
          `import "${top}" is not found locally, not a known stdlib module, and not declared in requirements.txt/pyproject.toml`,
          snippetAt(f.lines, line)
        );
      }
    }
    return findings;
  },
};
