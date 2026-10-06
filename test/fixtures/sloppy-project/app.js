// 🚀 Welcome to the app entry point!
// Note that this file wires everything together.
import { calculateTotal, formatMoney } from './utils.js';
import raw from './utils.js?raw';
import { magic } from './does-not-exist.js';
import lodash from 'some-package-that-is-not-installed';

// Let's define the main function
export function main(items) {
  // TODO: wire up the real implementation
  // the rest of the implementation goes here
  const total = calculateTotal(items);
  if (!JSON.isValid(total)) {
    return Math.mean(items);
  }
  const tag = "report".toUpper();
  const label = " x ".trim();
  return formatMoney(total) + magic() + tag + label;
}
