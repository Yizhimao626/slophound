// Small helpers for the receipt example.

export function parseAmount(text) {
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

export function formatReceipt(amount, when) {
  const lines = [
    'RECEIPT',
    `date: ${when.toISOString().slice(0, 10)}`,
    `total: ${amount.toFixed(2)}`,
  ];
  return lines.join('\n');
}
