# 🐕 SlopHound

**Sniff out AI slop in your repo — then clean it up.**

[![CI](https://github.com/your-username/slophound/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/slophound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/slophound)](package.json)
[中文文档](README.zh-CN.md)

Vibe coding is great until the slop ships. AI assistants leave a specific mess
behind: tests that can't fail, `// rest of the implementation goes here`,
five copies of the same helper, imports for packages that don't exist, and
comments that narrate every line like a tutorial. Reviewers miss these because
they *look* like work.

SlopHound is a zero-dependency, fully offline CLI that finds that mess, scores
your repo from 0–100, and — unlike every other detector — **removes what it
can safely remove**.

```
  slophound v0.1.0 — AI slop scanner

  Score   0/100  (F)
  Scanned 5 files · 71 lines · 6 rules · 9 findings

  MAJOR    copy-paste · 1 finding
    utils.js:10
      identical 8-line block appears 3 times (utils.js:10, utils.js:21, utils.js:32)
      | if (typeof cents !== 'number') {

  MAJOR    no-assert-tests · 3 findings
    app.test.js:4
      test case contains no assertions — it cannot fail
      | test('calculates the total', () => {

  MAJOR    placeholder-code · 2 findings
    script.py:13
      stub body ("...") — this function does nothing
      | ...

  MINOR    broken-imports · 1 finding
    app.js:5
      package "some-package-that-is-not-installed" is not installed in any node_modules up to the project root
      | import lodash from 'some-package-that-is-not-installed';

  INFO     slop-comments · 2 findings
    app.js:1
      3 AI-flavored comments: emoji in comment, "Note that", "let's"
      | // 🚀 Welcome to the app entry point!
```

## Why not just ESLint?

ESLint catches style and bug patterns per language, and needs a configured
plugin ecosystem to do it. SlopHound answers a different question: *"how much
unreviewed AI residue is in this repo?"* — across JavaScript, TypeScript and
Python, with zero config, zero install, zero network. It doesn't replace your
linter; it audits what your autocomplete wrote behind your back.

## What it detects

| Rule | Catches | Severity |
|---|---|---|
| `no-assert-tests` | Test cases that never assert anything — passing coverage that verifies nothing | major |
| `copy-paste` | Identical 8-line blocks repeated across the repo | major |
| `placeholder-code` | `...` / `todo!()` stub bodies, `"goes here"` / `"for brevity"` markers | minor / major |
| `broken-imports` *(beta)* | Relative imports that don't resolve; packages neither installed nor declared — the hallucinated-import signal (JS/TS, Python) | minor |
| `todo-sprawl` | Files accumulating 5+ TODO/FIXME/HACK markers | minor |
| `hallucinated-api` *(beta)* | Calls to members that don't exist on `Math`/`JSON`/`console`/`os`/... — e.g. `JSON.isValid()`, `Math.mean()` | info |
| `comment-ratio` | Files that are more than half comments | minor |
| `slop-comments` | LLM filler phrases and emoji headers in comments (English + Chinese) | info |

Languages: **JavaScript/TypeScript, Python, Go, Java, Rust, C#, Kotlin** (`slophound --list-rules` for the matrix). Severity can be overridden per rule in the config file.

## The score

```
100 − (weighted findings per 1000 lines) × 8
weights: info 0.25 · minor 1 · major 3 · critical 8
```

Grades: A+ ≥ 95 · A ≥ 85 · B ≥ 70 · C ≥ 50 · F < 50. The formula is
deliberately simple and printed in `--help` — a score you can't recompute is a
score you shouldn't trust.

## Quick start

```bash
# scan the current repo
npx slophound .

# fail CI on anything at or above "minor"
npx slophound . --fail-on minor

# see what --fix would delete, before deleting it
npx slophound . --fix-dry

# actually clean (removes slop comment lines only — never code)
npx slophound . --fix
```

No install step, no config file, no account. Node ≥ 18.

### CI gate

Exit code is `1` when findings reach the `--fail-on` severity (`major` by
default), so the CLI drops straight into any CI:

```yaml
# GitHub Actions
- run: npx slophound . --fail-on major
```

Or use the bundled composite action from a checkout of this repo:

```yaml
- uses: your-username/slophound@main
  with:
    path: src
    fail-on: minor
```

### Reports

- `--json` — machine-readable findings, summary, score (stdout)
- `--md [file]` — Markdown report for PR descriptions (`slophound-report.md`)
- `--sarif [file]` — SARIF 2.1.0 for GitHub code scanning and other SARIF platforms
- `--list-rules` — the rule catalog

### Existing repo? Use a baseline.

Old repos are full of pre-existing findings you can't fix this sprint. Record
them once, then gate only **new** slop:

```bash
npx slophound . --update-baseline slophound-baseline.json   # one-time snapshot
npx slophound . --baseline slophound-baseline.json          # CI: fails on new slop only
npx slophound . --prune-baseline slophound-baseline.json    # drop fingerprints you've fixed
```

Commit the baseline file. Findings in the baseline still show up in reports
(marked as known), but they don't count toward the score or the exit code.

### Configuration

`--init` writes a starter `slophound.config.json`:

```json
{
  "rules": {
    "slop-comments": { "enabled": true, "severity": "info" },
    "broken-imports": { "enabled": true, "ignore": ["@mycompany/internal-*"] }
  },
  "ignore": ["**/generated/**"],
  "failOn": "major"
}
```

`.sloprc.json` works too. Gitignore-style patterns are honored from both
`.gitignore` and `--ignore` / config `ignore`.

## Privacy & compliance, by design

- **100% offline.** No network code exists in the binary. Your code never
  leaves the machine.
- **No telemetry.** Nothing is collected. There is no account.
- **Zero dependencies.** The whole dependency tree is the Node standard
  library — nothing to audit, nothing to hijack.
- **`--fix` is conservative.** It deletes whole comment lines only (lines
  where the comment carries no code), previews with `--fix-dry`, and never
  touches executable lines.
- MIT licensed, all-original code, not affiliated with GitHub, OpenAI, or
  Anthropic.

## Editor integration

A minimal **VS Code extension** lives in [`vscode/`](vscode/README.md): the same
engine as Problems-panel diagnostics, with a workspace-scan command, on-save
rescans, a severity filter, and baseline support. It runs from a source
checkout (no bundling step); marketplace packaging is documented there.

## How SlopHound stays honest

The repo runs SlopHound on itself in CI (`npm run selfscan`), with the same
gate it sells you. If a change introduces slop into this codebase, CI fails.

## Roadmap

- [x] Go, Java, Rust, C#, Kotlin support
- [x] SARIF output for code-scanning integrations
- [x] `--baseline` to gate only new slop
- [x] Hallucinated *API* detection on well-known globals (beta)
- [x] Hallucinated *API* detection for literal receivers (strings, numbers, arrays)
- [x] VS Code extension (MVP, run-from-source)
- [x] `--baseline` auto-pruning (drop fingerprints that no longer occur)

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Every new rule needs a
positive and a negative fixture.

## Stay updated

Watch releases on GitHub (**Watch → Custom → Releases**) to get notified about
new rules and languages — or subscribe to release notes at
`<your-newsletter-link>`.

## License

[MIT](LICENSE) © The SlopHound Authors
