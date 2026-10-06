import { lineOfIndex, snippetAt } from '../util.js';

// Static members that genuinely exist on JS globals. Only calls are checked
// (a "(" right after the member name), so constant properties like Math.PI
// never match. A hallucinated method on one of these receivers is a strong
// AI-slop signal: plausible name, no such API.
const JS_MEMBERS = {
  Math: 'abs acos acosh asin asinh atan atan2 atanh cbrt ceil clz32 cos cosh exp expm1 floor fround hypot imul log log10 log1p log2 max min pow random round sign sin sinh sqrt tan tanh trunc'.split(' '),
  JSON: 'parse stringify rawJSON isRawJSON'.split(' '),
  Object: 'assign create defineProperty defineProperties entries freeze fromEntries getOwnPropertyDescriptor getOwnPropertyDescriptors getOwnPropertyNames getOwnPropertySymbols getPrototypeOf groupBy hasOwn is isExtensible isFrozen isSealed keys preventExtensions seal setPrototypeOf values'.split(' '),
  Array: 'from fromAsync isArray of'.split(' '),
  Promise: 'all allSettled any race resolve reject withResolvers try'.split(' '),
  Number: 'isFinite isInteger isNaN isSafeInteger parseFloat parseInt'.split(' '),
  String: 'fromCharCode fromCodePoint raw'.split(' '),
  Date: 'now parse UTC'.split(' '),
  Map: 'groupBy'.split(' '),
  Reflect: 'apply construct defineProperty deleteProperty get getOwnPropertyDescriptor getPrototypeOf has isExtensible ownKeys preventExtensions set setPrototypeOf'.split(' '),
  console: 'assert clear context count countReset debug dir dirxml error group groupCollapsed groupEnd info log profile profileEnd table time timeEnd timeLog timeStamp trace warn'.split(' '),
};

const PY_MEMBERS = {
  os: ('abort access chdir chmod chown close cpu_count curdir devnull dup dup2 environ error execl execle execlp execv execve execvp extsep fdopen fsdecode fsencode fspath fstat fsync get_exec_path get_blocking getcwd getcwdb getgrouplist getlogin getpid getppid getenv kill linesep link listdir lseek lstat makedirs mkdir name open pardir path pathsep pipe popen putenv read readlink remove removedirs rename renames replace rmdir scandir sep set_blocking setgid setuid stat strerror symlink sysconf system times truncate umask uname unlink unsetenv urandom utime wait waitpid walk').split(' '),
  json: 'dump dumps load loads tool decoder encoder JSONDecodeError detect_encoding'.split(' '),
  math: 'acos acosh asin asinh atan atan2 atanh cbrt ceil comb copysign cos cosh degrees dist e erf erfc exp expm1 fabs factorial floor fmod frexp fsum gamma gcd hypot inf isclose isfinite isinf isnan isqrt lcm ldexp lgamma log log10 log1p log2 modf nan nextafter perm pi pow prod radians remainder sin sinh sqrt tan tanh tau trunc ulp'.split(' '),
};

const JS_CALL_RE = /(?<![\w$.])(JSON|Math|Object|Array|Promise|Number|String|Date|Map|Reflect|console)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
const PY_CALL_RE = /(?<![\w$.])(os|json|math)\s*\.\s*([A-Za-z_]\w*)\s*\(/g;

// Literal receivers: "abc".subString(0), [1,2].flattened(), 42 .toFixeds()
// Real members whitelisted; the bracket guard rejects element access like
// arr[0].anything() so only true literals are checked.
const JS_STRING_METHODS = 'at charAt charCodeAt codePointAt concat endsWith includes indexOf lastIndexOf localeCompare match matchAll normalize padEnd padStart repeat replace replaceAll search slice split startsWith substring substr toLocaleLowerCase toLocaleUpperCase toLowerCase toString toUpperCase trim trimEnd trimStart valueOf'.split(' ');
const JS_NUMBER_METHODS = 'toExponential toFixed toLocaleString toPrecision toString valueOf'.split(' ');
const JS_ARRAY_METHODS = 'at concat copyWithin entries every fill filter find findIndex findLast findLastIndex flat flatMap forEach includes indexOf join keys lastIndexOf map pop push reduce reduceRight reverse shift slice some sort splice toLocaleString toReversed toSorted toSpliced toString unshift values with'.split(' ');

const PY_STRING_METHODS = 'capitalize casefold center count encode endswith expandtabs find format format_map index isalnum isalpha isdecimal isdigit isidentifier islower isnumeric isprintable isspace istitle isupper join ljust lower lstrip maketrans partition removeprefix removesuffix replace rfind rindex rjust rpartition rsplit rstrip split splitlines startswith strip swapcase title translate upper zfill'.split(' ');
const PY_LIST_METHODS = 'append clear copy count extend index insert pop remove reverse sort'.split(' ');
const PY_DICT_METHODS = 'clear copy fromkeys get items keys pop popitem setdefault update values'.split(' ');
const PY_SET_METHODS = 'add clear copy difference difference_update discard intersection intersection_update isdisjoint issubset issuperset pop remove symmetric_difference symmetric_difference_update union update'.split(' ');

// Lookbehind excludes ")"/"]" so chained element access and call results
// (split(...)[0].trim(), foo("x").bar()) are never mistaken for literals.
const JS_LITERAL_RE = /(?<![\w$.\\)\]])(['"`])[^'"`\n]*\1\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
const JS_NUMBER_RE = /(?<![\w$.\)])(\d+)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
const JS_ARRAY_RE = /(?<![\w$.\)\]])\[\s*(?:[\d.\s]+|['"][^'"\n]*['"](?:\s*,\s*['"][^'"\n]*['"])*)\s*,?\s*\]\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;

const PY_STRING_RE = /(?<![\w.\\)\]])(['"])[^'"\n]*\1\s*\.\s*([A-Za-z_]\w*)\s*\(/g;
const PY_LIST_RE = /(?<![\w$.\)\]])\[\s*(?:[\d.\s]+|['"][^'"\n]*['"](?:\s*,\s*['"][^'"\n]*['"])*)\s*,?\s*\]\s*\.\s*([A-Za-z_]\w*)\s*\(/g;
const PY_DICT_RE = /(?<![\w$.\)\]])\{[^{}\n]*\}\s*\.\s*([A-Za-z_]\w*)\s*\(/g;

const JS_LITERAL_TABLES = [
  [JS_STRING_METHODS, 'string'],
  [JS_NUMBER_METHODS, 'number'],
  [JS_ARRAY_METHODS, 'array'],
];

const PY_LITERAL_TABLES = [
  [PY_STRING_METHODS, 'string'],
  [PY_LIST_METHODS.concat(PY_SET_METHODS), 'list/set'],
  [PY_DICT_METHODS, 'dict'],
];

export default {
  id: 'hallucinated-api',
  name: 'Hallucinated API calls',
  description:
    'Beta: calls to members that do not exist on well-known globals (Math/JSON/Object/console... in JS; os/json/math in Python) or on string/number/array literals — a strong AI-hallucination signal.',
  defaultSeverity: 'info',
  languages: ['js', 'py'],
  run(files) {
    const findings = [];
    for (const f of files) {
      if (f.lang === 'js') {
        this.runJsGlobals(f, findings);
        this.runJsLiterals(f, findings);
      } else {
        this.runPyGlobals(f, findings);
        this.runPyLiterals(f, findings);
      }
    }
    return findings;
  },

  runJsGlobals(f, findings) {
    for (const m of f.masked.matchAll(JS_CALL_RE)) {
      const [, receiver, member] = m;
      const known = JS_MEMBERS[receiver];
      if (!known || known.includes(member)) continue;
      this.push(f, findings, m.index, `${receiver}.${member}() — no such member on ${receiver} (possible AI hallucination)`);
    }
  },

  runJsLiterals(f, findings) {
    for (const m of f.masked.matchAll(JS_LITERAL_RE)) {
      this.checkLiteral(f, findings, m, m[2], JS_LITERAL_TABLES, 'string', 'string');
    }
    for (const m of f.masked.matchAll(JS_ARRAY_RE)) {
      this.checkLiteral(f, findings, m, m[1], [[JS_ARRAY_METHODS, 'array']], 'array', 'array');
    }
    for (const m of f.masked.matchAll(JS_NUMBER_RE)) {
      this.checkLiteral(f, findings, m, m[2], [[JS_NUMBER_METHODS, 'number']], 'number', 'number');
    }
  },

  runPyGlobals(f, findings) {
    for (const m of f.masked.matchAll(PY_CALL_RE)) {
      const [, receiver, member] = m;
      const known = PY_MEMBERS[receiver];
      if (!known || known.includes(member)) continue;
      this.push(f, findings, m.index, `${receiver}.${member}() — no such member on ${receiver} (possible AI hallucination)`);
    }
  },

  runPyLiterals(f, findings) {
    for (const m of f.masked.matchAll(PY_STRING_RE)) {
      this.checkLiteral(f, findings, m, m[2], [[PY_STRING_METHODS, 'string']], 'string', 'string');
    }
    for (const m of f.masked.matchAll(PY_LIST_RE)) {
      this.checkLiteral(f, findings, m, m[1], [[PY_LIST_METHODS.concat(PY_SET_METHODS), 'list/set']], 'list/set', 'list/set');
    }
    for (const m of f.masked.matchAll(PY_DICT_RE)) {
      this.checkLiteral(f, findings, m, m[2], [[PY_DICT_METHODS, 'dict']], 'dict', 'dict');
    }
  },

  checkLiteral(f, findings, match, member, tables, fallbackKind, kindLabel) {
    for (const [methods, kind] of tables) {
      if (methods.includes(member)) return; // real method — fine
    }
    this.push(f, findings, match.index, `${member}() — no such method on a ${kindLabel} literal (possible AI hallucination)`);
  },

  push(f, findings, index, message) {
    findings.push({
      rule: this.id,
      severity: this.defaultSeverity,
      file: f.rel,
      line: lineOfIndex(f.raw, index),
      message,
      snippet: snippetAt(f.lines, lineOfIndex(f.raw, index)),
    });
  },
};
