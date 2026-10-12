import { eq, sql } from 'drizzle-orm';
import { salesPaymentError } from '@/lib/sales-payment';
import { db } from '@/lib/db';
import { customerPayments, customerSales, customers } from '@/lib/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const milli = (value: string | number) => Math.round(Number(value) * 1000);

export async function customerBalance(tx: Transaction, id: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
  const [customer] = await tx.select().from(customers).where(eq(customers.id, id));
  if (!customer) throw Error('Customer was not found.');
  const sales = await tx.select().from(customerSales).where(eq(customerSales.customerId, id));
  const payments = await tx.select().from(customerPayments).where(sql`${customerPayments.customerId} = ${id} and ${customerPayments.saleId} is null`);
  return milli(customer.openingBalance) + sales.reduce((sum, sale) => sum + milli(sale.total) - milli(sale.paid), 0) - payments.reduce((sum, payment) => sum + milli(payment.amount), 0);
}

// Keep invoice totals independent of carried balances. Any receipt above the
// invoice amount is an account receipt, counted once by the existing ledger.
export async function splitSalePayment(tx: Transaction, data: { customerId: string; paid: number; total: number; date: string; method?: string; notes?: string }, previous?: { total: string; paid: string; customerId: string; accountPaymentId?: string | null; existingBalance?: string | null }) {
  // Replacing an edited bill's receipt must not record the same cash twice.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.customerId}))`);
  if (previous?.accountPaymentId) await tx.delete(customerPayments).where(eq(customerPayments.id, previous.accountPaymentId));
  const balance = await customerBalance(tx, data.customerId);
  const availableExisting = balance - (previous?.customerId === data.customerId ? milli(previous.total) - milli(previous.paid) : 0);
  const existing = previous?.customerId === data.customerId && previous.existingBalance != null
    ? milli(previous.existingBalance) : Math.max(0, availableExisting);
  const grandTotal = data.total + existing;
  const paymentError = salesPaymentError((data.paid / 1000).toFixed(3), grandTotal);
  if (paymentError) throw Error(paymentError);
  // Later receipts can reduce the available balance, even though the invoice
  // retains its original carried balance for printing.
  if (data.paid > data.total + Math.max(0, availableExisting)) throw Error('Payment amount cannot exceed the outstanding balance.');
  // Account receipts have two decimal places in the existing database. Move
  // whole cents to the account, retaining the remainder on the invoice.
  const accountAmount = Math.max(0, Math.ceil((data.paid - data.total) / 10) * 10);
  if (accountAmount > data.paid) throw Error('Enter a payment with at most two decimal places.');
  let accountPaymentId: string | null = null;
  if (accountAmount > 0) {
    const [receipt] = await tx.insert(customerPayments).values({ customerId: data.customerId, saleId: null, paymentDate: data.date, amount: (accountAmount / 1000).toFixed(2), method: data.method || 'Cash', notes: data.notes || 'Payment toward existing balance with sales bill' }).returning({ id: customerPayments.id });
    accountPaymentId = receipt.id;
  }
  return { invoicePaid: data.paid - accountAmount, existingBalance: Math.max(0, existing), accountPaid: accountAmount, accountPaymentId };
}
