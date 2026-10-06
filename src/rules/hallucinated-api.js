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

export default {
  id: 'hallucinated-api',
  name: 'Hallucinated API calls',
  description:
    'Beta: calls to methods that do not exist on well-known globals (Math/JSON/Object/console... in JS; os/json/math in Python) — a strong AI-hallucination signal.',
  defaultSeverity: 'info',
  languages: ['js', 'py'],
  run(files) {
    const findings = [];
    for (const f of files) {
      const table = f.lang === 'py' ? PY_MEMBERS : JS_MEMBERS;
      const re = f.lang === 'py' ? PY_CALL_RE : JS_CALL_RE;
      for (const m of f.masked.matchAll(re)) {
        const [, receiver, member] = m;
        const known = table[receiver];
        if (!known || known.includes(member)) continue;
        const line = lineOfIndex(f.raw, m.index);
        findings.push({
          rule: this.id,
          severity: this.defaultSeverity,
          file: f.rel,
          line,
          message: `${receiver}.${member}() — no such member on ${receiver} (possible AI hallucination)`,
          snippet: snippetAt(f.lines, line),
        });
      }
    }
    return findings;
  },
};
