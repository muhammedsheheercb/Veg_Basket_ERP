import type { PdfData } from '@/components/pdf-download';
export const invoiceMoney = (n: number | string) => `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function salesPdfData(sale: any, business: any): PdfData {
  const balance = Number(sale.total) - Number(sale.paid);
  return {
    kind: 'Sales Invoice', title: sale.invoiceNumber, party: sale.customerName,
    business: [business?.address, business?.contactNumber, business?.email].filter(Boolean),
    sales: { date: sale.saleDate, status: balance <= 0 ? 'Paid' : Number(sale.paid) > 0 ? 'Partial' : 'Unpaid', method: sale.paymentMethod || '—', contact: sale.customerMobile || '', address: sale.customerAddress || '' },
    summary: [['Subtotal', invoiceMoney(sale.subtotal)], ['Discount', invoiceMoney(sale.discount)], ['Grand Total', invoiceMoney(sale.total)], ['Paid Amount', invoiceMoney(sale.paid)], ['Balance Amount', invoiceMoney(balance)]],
    headers: ['#', 'Item Description', 'Qty', 'Total (AED)'],
    rows: sale.items.map((item: any, index: number) => [String(index + 1), item.itemCode ? `${item.itemCode} · ${item.itemName.toUpperCase()}` : item.itemName.toUpperCase(), `${Number(item.quantity)} ${item.unit || ''}`.trim(), Number(item.lineTotal).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]),
    notes: sale.notes || undefined
  };
}
