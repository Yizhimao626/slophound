# Contributing

Thanks for helping make SlopHound sharper.

## Ground rules

1. **Zero runtime dependencies.** Everything runs on the Node.js standard
   library. If a feature seems to need a package, build the smallest possible
   version of it instead.
2. **Offline only.** No network calls, no telemetry — for any feature, ever.
3. **Every rule ships with a fixture.** Add both a positive case (code that
   should be flagged) and a negative case (similar code that must not be).

## Setup

```bash
git clone <your fork>
cd slophound
npm test          # runs node --test test/slophound.test.js
node bin/slophound.js src   # self-scan must stay clean
```

## Adding a rule

1. Create `src/rules/<rule-id>.js` exporting the standard rule shape:

```js
export default {
  id: 'my-rule',
  name: 'Human name',
  description: 'What it detects.',
  defaultSeverity: 'minor', // info | minor | major | critical
  languages: ['js', 'py'],
  run(files, ctx) {
    return []; // findings: { rule, severity, file, line, message, snippet? }
  },
};
```

2. Register it in `src/rules/index.js` and `src/config.js`.
3. Add fixtures under `test/fixtures/` and assert on them in
   `test/slophound.test.js`.
4. Run the self-scan — your rule must not flag SlopHound's own source.

## Style

- Plain modern ESM JavaScript, no build step.
- Comments explain constraints, not mechanics.
- Heuristics should prefer false negatives over false positives: a missed
  finding is a shrug, a wrong one erodes trust.
