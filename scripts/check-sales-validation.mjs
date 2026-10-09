import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
for (const path of ['app/api/sales/route.ts', 'app/api/sales/[id]/route.ts']) {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf('const cents');
  const end = source.indexOf('\nexport async function', start);
  const parsing = source.slice(start, end).replace(/: any|: string|: number/g, '');
  const context = vm.createContext({});
  vm.runInContext(parsing + '\nglobalThis.parseInvoice = parse;', context);
  const bill = { customerId: '11111111-1111-1111-1111-111111111111', date: '2026-10-09', discount: '2.50', paid: '10.00', items: [{ itemName: 'Fresh herbs', quantity: '2box', lineTotal: '12.50' }, { itemName: 'Custom produce', quantity: '1.5kg', lineTotal: '7.50' }] };
  const result = context.parseInvoice(bill);
  assert.equal(result.subtotal, 20000);
  assert.equal(result.total, 17500);
  assert.equal(result.lines[0].itemId, null);
  assert.equal(result.lines[0].itemName, 'FRESH HERBS');
  assert.equal(result.lines[1].itemName, 'CUSTOM PRODUCE');
  assert.equal(result.lines[0].unit, 'box');
  assert.equal(result.lines[0].unitPrice, 6250);
  assert.equal(result.lines[1].quantity, 1500);
  const precise = context.parseInvoice({ ...bill, discount: '0', paid: '0', items: [{ itemName: 'tomato', quantity: '3', unitPrice: '40.125', lineTotal: '999' }] });
  assert.equal(precise.lines[0].unitPrice, 40125);
  assert.equal(precise.lines[0].lineTotal, 120375);
  assert.equal(precise.total, 120375);
  assert.equal(context.parseInvoice({ ...bill, items: [{ itemName: 'tomato', quantity: '1', unitPrice: '1.2345' }] }), null);
  assert.equal(context.parseInvoice({ ...bill, paid: '18.00' }), null);
  assert.equal(context.parseInvoice({ ...bill, discount: '21.00' }), null);
  for (const quantity of ['1.2.3', '0', '-1', 'Infinity', '0.5']) {
    assert.equal(context.parseInvoice({ ...bill, items: [{ itemName: 'Produce', quantity, lineTotal: '10' }] }), null);
  }
  assert.equal(context.parseInvoice({ ...bill, items: [{ itemName: ' ', quantity: '1', lineTotal: '10' }] }), null);
}
console.log('Passed: create/edit manual names, units, quantity precision, derived price, totals, discounts, overpayments and invalid input.');
