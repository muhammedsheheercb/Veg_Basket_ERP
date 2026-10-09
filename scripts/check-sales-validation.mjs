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
  assert.equal(result.subtotal, 2000);
  assert.equal(result.total, 1750);
  assert.equal(result.lines[0].itemId, null);
  assert.equal(result.lines[0].itemName, 'FRESH HERBS');
  assert.equal(result.lines[1].itemName, 'CUSTOM PRODUCE');
  assert.equal(result.lines[0].unit, 'box');
  assert.equal(result.lines[0].unitPrice, 625);
  assert.equal(result.lines[1].quantity, 1500);
  assert.equal(context.parseInvoice({ ...bill, paid: '18.00' }), null);
  assert.equal(context.parseInvoice({ ...bill, discount: '21.00' }), null);
  for (const quantity of ['1.2.3', '0', '-1', 'Infinity']) {
    assert.equal(context.parseInvoice({ ...bill, items: [{ itemName: 'Produce', quantity, lineTotal: '10' }] }), null);
  }
  assert.equal(context.parseInvoice({ ...bill, items: [{ itemName: ' ', quantity: '1', lineTotal: '10' }] }), null);
}
console.log('Passed: create/edit manual names, units, quantity precision, derived price, totals, discounts, overpayments and invalid input.');
