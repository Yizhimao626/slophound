export function calculateTotal(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  return sum;
}

export function formatMoney(cents) {
  if (typeof cents !== 'number') {
    throw new TypeError('cents must be a number');
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}

export function formatMoneyV2(cents) {
  if (typeof cents !== 'number') {
    throw new TypeError('cents must be a number');
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}

export function formatMoneyLegacy(cents) {
  if (typeof cents !== 'number') {
    throw new TypeError('cents must be a number');
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}
