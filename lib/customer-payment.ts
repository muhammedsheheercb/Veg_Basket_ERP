export function customerPaymentError(value: unknown, outstanding?: number): string {
  const text = String(value ?? '').trim();
  const amount = Number(text);
  if (Number.isFinite(amount) && amount < 0) return 'Payment amount cannot be negative.';
  if (!text || !Number.isFinite(amount) || amount === 0) return 'Payment amount must be greater than zero.';
  if (outstanding !== undefined && amount > outstanding) return 'Payment amount cannot exceed the outstanding balance.';
  if (!Number.isSafeInteger(Math.round(amount * 100)) || amount > 999999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > .001) return 'Enter a valid payment with at most two decimal places.';
  return '';
}
