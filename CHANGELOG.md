# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-06

First public release.

### Added

- **8 rules across 7 languages** (JavaScript/TypeScript, Python, Go, Java, Rust, C#, Kotlin):
  - `no-assert-tests` — test cases that never assert anything (node:test/jest/vitest, pytest, go test, `#[test]`, `[TestMethod]`/`[Fact]`/`[Theory]`, JUnit `@Test`).
  - `copy-paste` — identical 8-line blocks repeated across the repo.
  - `placeholder-code` — stub bodies, "goes here" markers, `todo!()` / `panic("not implemented")` / `NotImplementedException` / `TODO()` stubs.
  - `hallucinated-api` (beta) — calls to members that do not exist on well-known globals (`Math`/`JSON`/`Object`/`console`/... in JS; `os`/`json`/`math` in Python) or on string/number/array/dict literals.
  - `broken-imports` (beta, JS/TS + Python) — relative imports that do not resolve; packages neither installed nor declared.
  - `todo-sprawl` — files accumulating 5+ TODO/FIXME/HACK markers.
  - `slop-comments` — LLM filler phrases and emoji headers in comments (English + Chinese).
  - `comment-ratio` — files that are more than half comments.
- **Fix mode**: `--fix-dry` previews, `--fix` removes slop comment lines only — never code, never foreign line endings.
- **Baseline workflow** for existing repos: `--update-baseline` (snapshot), `--baseline` (gate only new slop), `--prune-baseline` (drop fingerprints that no longer occur).
- **Output formats**: colored terminal report, `--json`, `--md` (Markdown for PRs), `--sarif` (SARIF 2.1.0 for code scanning).
- **CI gate**: `--fail-on <severity>` exit codes, reusable composite Action, GitHub Actions workflow (Ubuntu/Windows/macOS, Node 18/20/22).
- **Programmatic API** (`src/api.js`) — one scan implementation shared by the CLI, the VS Code extension (MVP, `vscode/`), and library consumers.
- `--list-rules`, `--init` config bootstrap, gitignore-style ignores, `paths` alias resolution, zero dependencies, fully offline.

### Changed

- Baseline fingerprints now use a two-lane 64-bit-equivalent hash instead of a single-lane djb2, making accidental collisions in large baselines practically impossible. If you recorded a baseline with an earlier build, re-run `--update-baseline` once.
- The score formula in the READMEs and `--help` now documents its 500-line floor.

### Fixed

- `--fix` preserves CRLF line endings instead of rewriting whole files on Windows.
- Invalid `--fail-on` / `--rules` values now fail loudly (exit 2) instead of silently disabling the CI gate.
- Missing option values (e.g. `--ignore` as the last argument) fail with a clear error instead of crashing.
- **Relative-import detection was silently dead** since the first build: a leftover `^\.|` alternative in `SKIP_SPEC_RE` skipped every `./`-specifier before the resolution branch ran. Relative imports now resolve (and misresolve) as documented.
- `broken-imports`: packages declared in `package.json` are no longer flagged when merely not installed; bundler suffixes (`?raw`, `?inline`, `#fragment`) no longer break resolution.
- `broken-imports`: a Python project's own package in a src-layout (`src/<pkg>/__init__.py`) is no longer reported as a hallucinated import.
- Markdown report marks baseline-suppressed findings as *(baseline)*.
