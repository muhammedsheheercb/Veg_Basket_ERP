// Grand totals use thousandths of an AED, matching sales storage and item rates.
export function salesPaymentError(value: unknown, grandTotal?: number): string {
  const text = String(value ?? '').trim();
  const amount = Number(text);
  if (Number.isFinite(amount) && amount < 0) return 'Payment amount cannot be negative.';
  if (!text || !Number.isFinite(amount)) return 'Enter a valid payment amount.';
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return 'Enter a valid payment amount with at most three decimal places.';
  const payment = Math.round(amount * 1000);
  if (!Number.isSafeInteger(payment)) return 'Enter a valid payment amount.';
  if (grandTotal !== undefined && payment > grandTotal) return 'Payment amount cannot exceed the Grand Total.';
  return '';
}
