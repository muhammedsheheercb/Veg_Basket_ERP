import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('lib/customer-payment.ts', 'utf8')
  .replace('export function', 'function')
  .replace('value: unknown, outstanding?: number', 'value, outstanding')
  .replace('): string', ')');
const context = vm.createContext({});
vm.runInContext(source + '\nglobalThis.validate = customerPaymentError;', context);
const check = context.validate;
assert.equal(check('-1', 100), 'Payment amount cannot be negative.');
for (const value of ['', '0', '0.00', null, 'NaN', 'Infinity']) {
  assert.equal(check(value, 100), 'Payment amount must be greater than zero.');
}
assert.equal(check('100.01', 100), 'Payment amount cannot exceed the outstanding balance.');
assert.equal(check('100', 100), '');
assert.equal(check('0.01', 0.01), '');
assert.equal(check('0.02', 0.015), 'Payment amount cannot exceed the outstanding balance.');
assert.equal(check('50', 100), '');
assert.equal(check('50', 40), 'Payment amount cannot exceed the outstanding balance.');
assert.equal(check('1', 0), 'Payment amount cannot exceed the outstanding balance.');
assert.equal(check('1.001', 100), 'Enter a valid payment with at most two decimal places.');
console.log('Passed: customer payment messages, invalid/zero/negative amounts, overpayments, exact balance, precision, and changed balances.');
