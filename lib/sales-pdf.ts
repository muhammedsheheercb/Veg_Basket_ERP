import type { PdfData } from '@/components/pdf-download';
export const invoiceMoney = (n: number | string) => `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

export function salesPaymentSummary(sale: any): [string, string][] {
  const milli = (value: string | number) => Math.round(Number(value || 0) * 1000);
  const subtotal = milli(sale.subtotal), discount = milli(sale.discount);
  const existing = milli(sale.existingBalance || 0);
  const paid = milli(sale.paid) + milli(sale.accountPaid || 0);
  const grandTotal = subtotal - discount + existing;
  return [
    ['Total Item Amount', invoiceMoney(subtotal / 1000)],
    ['Discount', invoiceMoney(discount / 1000)],
    ['Existing Balance Amount', invoiceMoney(existing / 1000)],
    ['Grand Total', invoiceMoney(grandTotal / 1000)],
    ['Paid Amount', invoiceMoney(paid / 1000)],
    ['Remaining Balance', invoiceMoney((grandTotal - paid) / 1000)],
  ];
}

export function salesPdfData(sale: any, business: any): PdfData {
  const balance = Number(sale.total) - Number(sale.paid);
  return {
    kind: 'Sales Invoice', title: sale.invoiceNumber, party: sale.customerName,
    business: [business?.address, business?.contactNumber, business?.email].filter(Boolean),
    sales: { date: sale.saleDate, status: balance <= 0 ? 'Paid' : Number(sale.paid) > 0 ? 'Partial' : 'Unpaid', method: sale.paymentMethod || '—', contact: sale.customerMobile || '', address: sale.customerAddress || '' },
    summary: salesPaymentSummary(sale),
    headers: ['#', 'Item Description', 'Qty', 'Rate (AED)', 'Total (AED)'],
    rows: sale.items.map((item: any, index: number) => [String(index + 1), item.itemCode ? `${item.itemCode} · ${item.itemName.toUpperCase()}` : item.itemName.toUpperCase(), `${Number(item.quantity)} ${item.unit || ''}`.trim(), Number(item.unitPrice).toFixed(3), Number(item.lineTotal).toLocaleString('en-AE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })]),
    notes: sale.notes || undefined
  };
}
