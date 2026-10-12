import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { salesPaymentSummary, salesPdfData } from '../lib/sales-pdf.ts';
const sale = { invoiceNumber: 'SAL-TEST', subtotal: '200.000', discount: '0.000', total: '200.000', existingBalance: '318.000', paid: '200.000', accountPaid: '300.000', items: [] };
assert.deepEqual(salesPaymentSummary(sale), [
  ['Total Item Amount', 'AED 200.000'], ['Discount', 'AED 0.000'],
  ['Existing Balance Amount', 'AED 318.000'], ['Grand Total', 'AED 518.000'],
  ['Paid Amount', 'AED 500.000'], ['Remaining Balance', 'AED 18.000'],
]);
assert.deepEqual(salesPdfData(sale, {}).summary, salesPaymentSummary(sale));
const credit = salesPdfData({ ...sale, paid: '0.000', accountPaid: '0.000' }, {});
assert.equal(credit.summary[4][1], 'AED 0.000');
assert.equal(credit.summary[5][1], 'AED 518.000');
assert.equal(credit.sales.status, 'Unpaid');
const precise = salesPaymentSummary({ ...sale, subtotal: '0.301', discount: '0.001', paid: '0.100', accountPaid: '0', existingBalance: '0.100' });
assert.deepEqual(precise.slice(3), [['Grand Total', 'AED 0.400'], ['Paid Amount', 'AED 0.100'], ['Remaining Balance', 'AED 0.300']]);
const legacy = salesPaymentSummary({ ...sale, accountPaid: undefined, existingBalance: null });
assert.equal(legacy[2][1], 'AED 0.000');
assert.equal(legacy[4][1], 'AED 200.000');
assert.match(readFileSync('app/sales/page.tsx', 'utf8'), /salesPaymentSummary\(sale\)\.map/);
assert.match(readFileSync('components/pdf-download.tsx', 'utf8'), /'Remaining Balance'\]\.includes/);
console.log('Passed: complete PDF/preview summary, carried payment, discount, precision, historical fallback, and emphasized totals.');
