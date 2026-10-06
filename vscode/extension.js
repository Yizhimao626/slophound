// SlopHound VS Code extension (MVP).
//
// Runs the same scanner core as the CLI (../src/api.js, imported dynamically
// so the extension stays CommonJS) and surfaces findings in the Problems
// panel. Findings already recorded in a baseline file are hidden, so the
// editor shows only new slop.
//
// This extension is designed to run from a source checkout of the slophound
// repository (see vscode/README.md). Marketplace packaging needs a bundling
// step and is intentionally out of scope for the MVP.

const vscode = require('vscode');
const path = require('path');
const { pathToFileURL } = require('url');

const SEVERITY_MAP = {
  critical: vscode.DiagnosticSeverity.Error,
  major: vscode.DiagnosticSeverity.Error,
  minor: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

const MIN_SEVERITY_RANK = { critical: 3, major: 2, minor: 1, info: 0 };
const SCAN_LANGS = new Set(['javascript', 'typescript', 'typescriptreact', 'javascriptreact', 'python', 'go', 'java', 'rust', 'csharp', 'kotlin']);

let diagnostics;
let channel;
let apiPromise;
let rescanTimer;

function getApi() {
  if (!apiPromise) {
    const core = path.join(__dirname, '..', 'src', 'api.js');
    apiPromise = import(pathToFileURL(core).href);
  }
  return apiPromise;
}

async function scanWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;
  const root = folders[0].uri.fsPath;
  const cfg = vscode.workspace.getConfiguration('slophound');
  const minRank = MIN_SEVERITY_RANK[cfg.get('severity', 'info')] ?? 0;
  const baselineRel = cfg.get('baseline', '');

  try {
    const { scanPath } = await getApi();
    const { result } = await scanPath(root, {
      maxFiles: 2000,
      baseline: baselineRel ? path.join(root, baselineRel) : null,
      onError: (msg) => channel.appendLine(`warning: ${msg}`),
    });

    diagnostics.clear();
    const byFile = new Map();
    let shown = 0;
    for (const f of result.findings) {
      if ((MIN_SEVERITY_RANK[f.severity] ?? 0) < minRank) continue;
      if (!byFile.has(f.file)) byFile.set(f.file, []);
      byFile.get(f.file).push(f);
    }
    for (const [rel, list] of byFile) {
      const uri = vscode.Uri.file(path.join(root, rel));
      const diags = list.map((f) => {
        const line = Math.max(f.line - 1, 0);
        const d = new vscode.Diagnostic(
          new vscode.Range(line, 0, line, 200),
          `[${f.rule}] ${f.message}`,
          SEVERITY_MAP[f.severity] ?? vscode.DiagnosticSeverity.Information
        );
        d.source = 'slophound';
        return d;
      });
      diagnostics.set(uri, diags);
      shown += diags.length;
    }
    channel.appendLine(
      `[${new Date().toLocaleTimeString()}] ${result.files} files · score ${result.score}/100 (${result.grade}) · ${shown} findings` +
        (result.baselineCount ? ` · ${result.baselineCount} hidden by baseline` : '')
    );
  } catch (e) {
    channel.appendLine(`scan failed: ${e.message}`);
  }
}

function scheduleRescan() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(scanWorkspace, 800);
}

function activate(context) {
  channel = vscode.window.createOutputChannel('SlopHound');
  diagnostics = vscode.languages.createDiagnosticCollection('slophound');
  context.subscriptions.push(channel, diagnostics);

  context.subscriptions.push(
    vscode.commands.registerCommand('slophound.scanWorkspace', scanWorkspace),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (SCAN_LANGS.has(doc.languageId)) scheduleRescan();
    })
  );

  if (vscode.workspace.workspaceFolders) {
    setTimeout(scanWorkspace, 1500);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
