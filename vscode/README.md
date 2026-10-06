# SlopHound for VS Code (MVP)

The editor companion to the [SlopHound CLI](../README.md): the same rules,
the same scoring, surfaced as Problems-panel diagnostics as you work.

## What it does

- Scans your workspace with the CLI's engine on startup, on the "SlopHound:
  Scan Workspace" command, and (debounced) when you save a scanned file.
- Shows findings in the Problems panel; `major`/`critical` as Errors,
  `minor` as Warnings, `info` as Information.
- Honors a baseline file (`slophound.baseline` setting) so the editor only
  shows **new** slop, not your pre-existing debt.
- Writes the same privacy guarantees: fully offline, no telemetry.

## Run from source

The MVP intentionally ships without a bundling step — it loads the scanner
core (`../src/api.js`) straight from a checkout of this repository:

1. Clone the slophound repository.
2. In VS Code: `Extensions: Install Extension from Location...` → select the
   `vscode/` folder of the checkout. (Or launch a dev host with
   `code --extensionDevelopmentPath=<repo>/vscode`.)
3. Run `SlopHound: Scan Workspace` from the command palette.

## Packaging (roadmap)

Publishing to the Marketplace requires bundling the core into the extension
folder (e.g. with esbuild) and a publisher ID. The scanner API was factored
into `src/api.js` precisely so that step is mechanical:

```bash
cd vscode
npx @vscode/vsce package   # after adding a bundle step for ../src
```

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `slophound.severity` | `info` | Minimum severity shown in Problems |
| `slophound.baseline` | _(empty)_ | Baseline file relative to workspace root |
