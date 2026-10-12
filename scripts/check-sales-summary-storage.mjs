import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { salesPaymentError } from '../lib/sales-payment.ts';
const source = stripTypeScriptTypes(readFileSync('lib/customer-balance.ts', 'utf8'))
  .replace(/^import .*;$/gm, '').replace(/export /g, '');
const receipts = [];
const invoices = [];
const context = vm.createContext({ salesPaymentError, eq: () => 0, sql: () => 0, customers: 'customers', customerSales: 'sales', customerPayments: 'payments' });
vm.runInContext(source + '\nglobalThis.split = splitSalePayment; globalThis.balance = customerBalance;', context);
let nextId = 0;
const tx = {
  execute: async () => {},
  select: () => ({ from: table => ({ where: async () => table === 'customers' ? [{ openingBalance: '318.00' }] : table === 'sales' ? invoices : receipts }) }),
  insert: () => ({ values: value => ({ returning: async () => { const receipt = { ...value, id: `receipt-${++nextId}` }; receipts.push(receipt); return [receipt]; } }) }),
  delete: () => ({ where: async () => receipts.splice(0, 1) }),
};
const bill = { customerId: 'customer', paid: 500000, total: 200000, date: '2026-10-12' };
const first = await context.split(tx, bill);
assert.equal(first.existingBalance, 318000);
assert.equal(first.invoicePaid, 200000);
assert.equal(first.accountPaid, 300000);
assert.equal(receipts.length, 1);
const previous = { customerId: bill.customerId, total: '200.000', paid: '200.000', existingBalance: '318.000', accountPaymentId: first.accountPaymentId };
invoices.push(previous);
const edited = await context.split(tx, bill, previous);
assert.equal(edited.existingBalance, 318000);
assert.equal(edited.accountPaid, 300000);
assert.equal(receipts.length, 1, 'Editing must replace the carried receipt rather than duplicate it.');
const credit = await context.split(tx, { ...bill, paid: 0 });
assert.equal(credit.invoicePaid, 0);
assert.equal(credit.accountPaid, 0);
assert.equal(credit.accountPaymentId, null);
assert.equal(receipts.length, 1, 'Credit sales must not create payment receipts.');
const beforeCreditSale = await context.balance(tx, bill.customerId);
invoices.push({ customerId: bill.customerId, total: '200.000', paid: '0.000' });
assert.equal(await context.balance(tx, bill.customerId), beforeCreditSale + 200000, 'A zero-payment sale adds its full amount to the customer balance.');
console.log('Passed: stored carried balance/full bill payment, and editing without duplicate receipts.');
