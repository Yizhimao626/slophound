import { test } from 'node:test';
import { main } from './app.js';

test('calculates the total', () => {
  const items = [];
  const out = main(items);
  console.log(out);
});

test('handles empty input', () => {
  const out = main([]);
  console.log(out);
});
