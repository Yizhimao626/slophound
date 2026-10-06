// Reads the amount from the command line and prints a receipt.
import assert from 'node:assert/strict';
import { parseAmount, formatReceipt } from './lib.js';

const amount = parseAmount(process.argv[2] ?? '0');
console.log(formatReceipt(amount, new Date()));
assert.ok(amount >= 0, 'amount must not be negative');
