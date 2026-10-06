import { RULES } from './rules/index.js';

const LEVEL_BY_SEVERITY = { critical: 'error', major: 'error', minor: 'warning', info: 'note' };

// Minimal but valid SARIF 2.1.0 — enough for GitHub code scanning ingestion.
export function toSarif(result) {
  const ruleIds = [...new Set(result.findings.map((f) => f.rule))];
  const rules = RULES.filter((r) => ruleIds.includes(r.id)).map((r) => ({
    id: r.id,
    shortDescription: { text: r.name },
    fullDescription: { text: r.description },
    defaultConfiguration: { level: LEVEL_BY_SEVERITY[r.defaultSeverity] ?? 'note' },
  }));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'slophound',
            version: result.version,
            informationUri: 'https://github.com/Yizhimao626/slophound',
            rules,
          },
        },
        columnKind: 'utf16CodeUnits',
        results: result.findings.map((f) => ({
          ruleId: f.rule,
          level: LEVEL_BY_SEVERITY[f.severity] ?? 'note',
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: { startLine: f.line },
              },
            },
          ],
        })),
      },
    ],
  };
}
