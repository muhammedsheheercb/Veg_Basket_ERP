import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('lib/sales-payment.ts', 'utf8')
  .replace('export function', 'function')
  .replace('value: unknown, grandTotal?: number', 'value, grandTotal')
  .replace('): string', ')');
const context = vm.createContext({});
vm.runInContext(source + '\nglobalThis.validate = salesPaymentError;', context);
const check = context.validate;
assert.equal(check('-1', 100000), 'Payment amount cannot be negative.');
for (const value of ['0', '0.000']) {
  assert.equal(check(value, 100000), '');
  assert.equal(check(value, 0), '');
}
for (const value of ['', null, 'NaN', 'Infinity']) {
  assert.equal(check(value, 100000), 'Enter a valid payment amount.');
}
assert.equal(check('100.001', 100000), 'Payment amount cannot exceed the Grand Total.');
assert.equal(check('100', 100000), '');
assert.equal(check('0.001', 1), '');
assert.equal(check('0.301', 300), 'Payment amount cannot exceed the Grand Total.');
assert.equal(check('20', 10000), 'Payment amount cannot exceed the Grand Total.');
assert.equal(check('20', 30000), '');
assert.equal(check('10.1234', 30000), 'Enter a valid payment amount with at most three decimal places.');
console.log('Passed: payment limits, exact error messages, zero/negative/invalid input, three-decimal precision, and changing grand totals.');
