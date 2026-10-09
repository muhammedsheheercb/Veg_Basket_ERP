import { asc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { customerSales, customers, items, saleItems } from './schema';
export async function detail(id: string) {
  const [sale] = await db.select({
    id: customerSales.id,
    invoiceNumber: customerSales.invoiceNumber,
    customerId: customerSales.customerId,
    saleDate: customerSales.saleDate,
    subtotal: customerSales.subtotal,
    discount: customerSales.discount,
    total: customerSales.total,
    paid: customerSales.paid,
    paymentMethod: customerSales.paymentMethod,
    notes: customerSales.notes,
    customerName: customers.name,
    customerMobile: customers.mobile,
    customerAddress: customers.address
  }).from(customerSales).innerJoin(customers, eq(customerSales.customerId, customers.id)).where(eq(customerSales.id, id));

  if (!sale) return null;

  const lines = await db.select({
    id: saleItems.id,
    itemId: saleItems.itemId,
    itemCode: items.code,
    itemName: sql<string>`upper(coalesce(${saleItems.itemName}, ${items.name}))`,
    quantity: saleItems.quantity,
    unit: saleItems.unit,
    unitPrice: saleItems.unitPrice,
    lineTotal: saleItems.lineTotal
  }).from(saleItems).leftJoin(items, eq(saleItems.itemId, items.id)).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.position));

  return { ...sale, items: lines };
}

