import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_FILENAMES } from './config.js';
import { scanPath, fingerprint, loadBaseline, version } from './api.js';
import { RULES } from './rules/index.js';
import { printTerminal, toMarkdown } from './report.js';
import { runFix } from './fix.js';
import { toSarif } from './sarif.js';
import { SEVERITY_ORDER, setColorEnabled, c } from './util.js';

const pkg = { version };

const HELP = `
  slophound v${pkg.version} — sniff out AI slop in your repo

  Usage
    $ slophound [path] [options]

  Options
    --json              output JSON to stdout (overrides terminal report)
    --md [file]         also write a Markdown report (default: slophound-report.md)
    --sarif [file]      also write a SARIF 2.1.0 report (default: slophound.sarif.json)
    --fix               remove slop comment lines (writes changes)
    --fix-dry           preview what --fix would remove, change nothing
    --fail-on <sev>     exit 1 when findings reach this severity: info|minor|major|critical|none (default: major)
    --baseline <file>   suppress findings recorded in a baseline file (only new slop counts)
    --prune-baseline <file>
                        like --baseline, and rewrite the file without fingerprints
                        that no longer occur (fixed issues leave the baseline)
    --update-baseline <file>
                        write all current findings to a baseline file and exit 0
    --rules <a,b>       run only these rules
    --list-rules        print the rule catalog and exit
    --ignore <glob>     ignore files/dirs (repeatable, gitignore-style)
    --max-files <n>     cap scanned files (default: 5000)
    --no-color          disable colored output
    --color             force colored output (also on non-TTY)
    --init              write a starter slophound.config.json
    -v, --version       print version
    -h, --help          print this help

  Rules
    no-assert-tests     test cases that never assert anything (7 languages)          (major)
    placeholder-code    stub bodies, "goes here" markers, TODO()/panic stubs         (minor)
    slop-comments       AI filler phrases / emoji comments (EN + 中文)                (info)
    comment-ratio       files that are more than half comments                       (minor)
    copy-paste          identical 8-line blocks repeated                             (major)
    broken-imports      unresolvable / undeclared imports (beta, js/py)              (minor)
    todo-sprawl         5+ TODO/FIXME/HACK markers in one file                       (minor)
    hallucinated-api    calls to members that don't exist on Math/JSON/os/... (beta) (info)

  Languages
    JavaScript/TypeScript · Python · Go · Java · Rust · C# · Kotlin

  Score
    100 - (weighted findings per 1000 lines) x 8
    weights: info 0.25 · minor 1 · major 3 · critical 8

  Baseline workflow (existing repos)
    $ slophound . --update-baseline slophound-baseline.json   # record current state
    $ slophound . --baseline slophound-baseline.json          # gate only NEW slop

  Examples
    $ slophound .
    $ slophound src --json --fail-on minor
    $ slophound . --fix-dry
    $ slophound . --md report.md --sarif --rules no-assert-tests,copy-paste

  Fully offline. Zero dependencies. Nothing about your code leaves this machine.
`;

function parseArgs(argv) {
  // Every value-taking flag goes through need() so a missing value fails
  // with a clear message instead of undefined flowing into the scan.
  const need = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v === '') throw new Error(`missing value for ${flag}`);
    return v;
  };
  const opts = {
    target: '.',
    json: false,
    md: null,
    sarif: null,
    failOn: null,
    rules: null,
    ignore: [],
    maxFiles: null,
    color: null,
    init: false,
    fix: false,
    fixDry: false,
    baseline: null,
    pruneBaseline: null,
    updateBaseline: null,
    listRules: false,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--json': opts.json = true; break;
      case '--md': {
        const v = argv[i + 1];
        if (v && !v.startsWith('--')) { opts.md = v; i++; } else { opts.md = 'slophound-report.md'; }
        break;
      }
      case '--sarif': {
        const v = argv[i + 1];
        if (v && !v.startsWith('--')) { opts.sarif = v; i++; } else { opts.sarif = 'slophound.sarif.json'; }
        break;
      }
      case '--fix': opts.fix = true; break;
      case '--fix-dry': opts.fixDry = true; break;
      case '--fail-on': opts.failOn = need(i, '--fail-on'); i++; break;
      case '--baseline': opts.baseline = need(i, '--baseline'); i++; break;
      case '--prune-baseline': {
        const v = need(i, '--prune-baseline');
        opts.baseline = v;
        opts.pruneBaseline = v;
        i++;
        break;
      }
      case '--update-baseline': opts.updateBaseline = need(i, '--update-baseline'); i++; break;
      case '--rules': opts.rules = need(i, '--rules').split(',').map((s) => s.trim()).filter(Boolean); i++; break;
      case '--list-rules': opts.listRules = true; break;
      case '--ignore': opts.ignore.push(need(i, '--ignore')); i++; break;
      case '--max-files': {
        const v = need(i, '--max-files');
        opts.maxFiles = Number.parseInt(v, 10);
        if (!Number.isFinite(opts.maxFiles) || opts.maxFiles <= 0) throw new Error(`invalid value for --max-files: ${v}`);
        i++;
        break;
      }
      case '--no-color': opts.color = false; break;
      case '--color': opts.color = true; break;
      case '--init': opts.init = true; break;
      case '--help': case '-h': opts.help = true; break;
      case '--version': case '-v': opts.version = true; break;
      default:
        if (a.startsWith('-')) throw new Error(`unknown option: ${a} (see --help)`);
        opts.target = a;
    }
  }
  return opts;
}

function scan(root, opts) {
  if (opts.rules) {
    const known = new Set(RULES.map((r) => r.id));
    for (const id of opts.rules) {
      if (!known.has(id)) throw new Error(`unknown rule "${id}" (see --list-rules)`);
    }
  }
  return scanPath(root, {
    target: opts.target,
    rules: opts.rules,
    ignore: opts.ignore,
    maxFiles: opts.maxFiles,
    baseline: opts.baseline,
    failOn: opts.failOn,
    onError: (msg) => console.error(c.yellow(`slophound: ${msg}`)),
  });
}

export function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(c.red(`slophound: ${e.message}`));
    return 2;
  }
  setColorEnabled(opts.color);

  if (opts.version) {
    console.log(`slophound v${pkg.version}`);
    return 0;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (opts.listRules) {
    console.log('Rules (run slophound . to scan):\n');
    for (const r of RULES) {
      const langs = r.languages.join('/');
      console.log(`  ${r.id.padEnd(18)} ${r.defaultSeverity.padEnd(7)} [${langs}]  ${r.description}`);
    }
    return 0;
  }
  if (opts.init) {
    const file = path.resolve(process.cwd(), 'slophound.config.json');
    if (fs.existsSync(file)) {
      console.error(c.red(`slophound: ${file} already exists`));
      return 2;
    }
    fs.writeFileSync(file, JSON.stringify({ rules: {}, ignore: [], failOn: 'major' }, null, 2) + '\n');
    console.log(`Wrote ${file}`);
    return 0;
  }

  const root = path.resolve(opts.target);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(c.red(`slophound: not a directory: ${opts.target}`));
    return 2;
  }

  try {
    const { config, result, loaded, active } = scan(root, opts);

    if (opts.updateBaseline && (opts.fix || opts.fixDry)) {
      console.log(c.yellow('slophound: note — --fix is ignored when --update-baseline is set.'));
    }

    if (opts.pruneBaseline) {
      const before = loadBaseline(opts.pruneBaseline).size;
      const keep = result.findings.map(fingerprint);
      fs.writeFileSync(
        opts.pruneBaseline,
        JSON.stringify(
          {
            version: 1,
            tool: 'slophound',
            updatedAt: new Date().toISOString(),
            fingerprints: keep,
          },
          null,
          2
        ) + '\n'
      );
      const pruned = before - keep.length;
      console.log(
        pruned > 0
          ? `Baseline pruned: ${pruned} stale fingerprint(s) removed, ${keep.length} kept (${opts.pruneBaseline}).`
          : `Baseline up to date — nothing to prune (${keep.length} fingerprint(s), ${opts.pruneBaseline}).`
      );
      return 0;
    }

    if (opts.updateBaseline) {
      fs.writeFileSync(
        opts.updateBaseline,
        JSON.stringify(
          {
            version: 1,
            tool: 'slophound',
            updatedAt: new Date().toISOString(),
            fingerprints: result.findings.map(fingerprint),
          },
          null,
          2
        ) + '\n'
      );
      console.log(`Baseline written to ${opts.updateBaseline} (${result.findings.length} findings recorded)`);
      return 0;
    }

    if (opts.fix || opts.fixDry) {
      const code = runFix(loaded, opts);
      if (!fs.existsSync(path.join(root, '.git')) && opts.fix && !opts.fixDry) {
        console.log(c.yellow('slophound: note — this is not a git repository, changes cannot be reverted via git.'));
      }
      return code;
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printTerminal(result);
    }
    if (opts.md) {
      fs.writeFileSync(opts.md, toMarkdown(result));
      if (!opts.json) console.log(c.gray(`Markdown report written to ${opts.md}`));
    }
    if (opts.sarif) {
      fs.writeFileSync(opts.sarif, JSON.stringify(toSarif(result), null, 2));
      if (!opts.json) console.log(c.gray(`SARIF report written to ${opts.sarif}`));
    }

    if (result.baselineCount > 0 && !opts.json) {
      console.log(c.gray(`${result.baselineCount} known finding(s) suppressed by baseline — only new slop counts.`));
    }
    if (result.truncated) {
      console.error(c.yellow(`slophound: file limit reached (${config.maxFiles}); results are partial. Raise --max-files or add --ignore.`));
    }

    const threshold = SEVERITY_ORDER[config.failOn];
    if (threshold === undefined) return 0;
    return active.some((f) => SEVERITY_ORDER[f.severity] >= threshold) ? 1 : 0;
  } catch (e) {
    console.error(c.red(`slophound: ${e.message}`));
    return 2;
  }
}

export { CONFIG_FILENAMES, loadBaseline };
