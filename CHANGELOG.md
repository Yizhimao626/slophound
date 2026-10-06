# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-06

### Added

- `hallucinated-api` now also checks **literal receivers**: string, number, and
  array literals in JavaScript; string, list/set, and dict literals in Python
  (e.g. `"abc".subString(0)`, `[1,2].flattened()`, `"slop".strips()`). Real
  members are whitelisted; element access like `arr[0].foo()` is never flagged.
- **`--prune-baseline <file>`**: scan with a baseline and rewrite it without
  fingerprints that no longer occur — fixed issues leave the baseline instead
  of accumulating forever.

## [0.3.0] - 2026-10-06

### Added

- **C# and Kotlin support** — 7 languages total. `no-assert-tests` understands
  `[TestMethod]` / `[Fact]` / `[Theory]` (MSTest/xUnit/NUnit) and `@Test` (JUnit for
  Kotlin); `placeholder-code` recognizes `NotImplementedException` and Kotlin's
  `TODO()`. Comment-based rules cover both languages.
- New rule `hallucinated-api` (beta): flags calls to members that do not exist on
  well-known globals — `Math`/`JSON`/`Object`/`console`/... in JavaScript,
  `os`/`json`/`math` in Python (e.g. `JSON.isValid()`, `Math.mean()`, `os.listdirs()`).
  Real members are whitelisted; property access and non-globals are ignored.
- **VS Code extension MVP** (`vscode/`): Problems-panel diagnostics from the same
  engine, workspace scan command, on-save rescans, severity filter and baseline
  support. Runs from a source checkout; marketplace packaging documented.
- **Programmatic API** (`src/api.js`): `scanPath(root, options)` — the single
  scan implementation now shared by the CLI, the extension, and library consumers.

## [0.2.0] - 2026-10-06

### Added

- **Go, Java, and Rust support.** `no-assert-tests` now understands `func TestX(t *testing.T)`,
  `@Test` JUnit methods, and `#[test]` functions; `placeholder-code` recognizes
  `todo!()` / `unimplemented!()`, `panic("not implemented")`, and
  `UnsupportedOperationException`. Comment-based rules work in all five languages.
- **Baseline workflow** for existing repos: `--update-baseline <file>` records current
  findings; `--baseline <file>` suppresses them so CI gates only *new* slop.
  Suppressed findings still appear in reports, flagged as baseline.
- **SARIF 2.1.0 output** (`--sarif [file]`) for GitHub code scanning and other
  SARIF-capable platforms.
- New rule `todo-sprawl`: flags files with 5+ TODO/FIXME/HACK markers.
- `--list-rules`: prints the rule catalog.

## [0.1.0] - 2026-10-06

### Added

- Core scanner for JavaScript / TypeScript / Python projects (zero dependencies, fully offline).
- Rules:
  - `no-assert-tests` — test cases that never assert anything.
  - `placeholder-code` — stub bodies and "for brevity / goes here" placeholders.
  - `slop-comments` — AI-flavored comment patterns (filler phrases, emoji headers) in English and Chinese.
  - `comment-ratio` — files dominated by comments rather than code.
  - `copy-paste` — identical multi-line blocks repeated across the repo.
  - `broken-imports` (experimental) — relative imports that do not resolve, and packages that are neither installed nor declared.
- 0–100 slop score with letter grade, transparent formula.
- Terminal, JSON, and Markdown report output.
- `--fix` / `--fix-dry`: safely remove slop comment lines (dry-run diff by default).
- CI-friendly exit codes and `--fail-on` severity gate.
- Config file support (`slophound.config.json` / `.sloprc.json`).
- GitHub Actions workflow and a reusable composite Action.
