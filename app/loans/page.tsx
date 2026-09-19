// @ts-nocheck
'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ListFilters, ListPagination, useListControls } from '@/components/list-controls';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  WalletCards,
  X,
} from 'lucide-react';
import { downloadPdfFromElement } from '@/components/pdf-download';

type LoanRow = {
  id: string;
  name: string;
  original: string;
  outstanding: string;
  date: string;
  emi: string;
  nextEmiDate?: string | null;
  nextEmiAmount?: string | null;
  description?: string | null;
  payments: number;
  paid: string;
};

type PaymentRow = {
  id: string;
  loanId: string;
  paymentDate: string;
  amount: string;
  method?: string;
  notes?: string;
  createdAt: string;
  balanceAfter?: number;
};

type LoanDetail = {
  loan: {
    id: string;
    lender: string;
    originalAmount: string;
    outstanding: string;
    loanDate: string;
    minimumEmi: string;
    nextEmiDate?: string | null;
    nextEmiAmount?: string | null;
    description?: string | null;
  };
  payments: PaymentRow[];
};

const money = (x: number | string) =>
  `AED ${Number(x || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = new Date().toISOString().slice(0, 10);

export default function LoansPage() {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled'>('all');

  // Modals
  const [formLoan, setFormLoan] = useState<LoanRow | null | undefined>(undefined); // undefined = closed, null = create, object = edit
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [payLoan, setPayLoan] = useState<LoanRow | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [deleteLoan, setDeleteLoan] = useState<LoanRow | null>(null);
  const [reversePayment, setReversePayment] = useState<{ loanId: string; payment: PaymentRow } | null>(null);
  const [printLoan, setPrintLoan] = useState<LoanDetail | null>(null);
  const loanPrintRef = useRef<HTMLElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/loans');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRows(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalBorrowed = 0;
    let totalRepaid = 0;
    let totalOutstanding = 0;
    let activeCount = 0;

    for (const r of rows) {
      const orig = Number(r.original || r.outstanding || 0);
      const paid = Number(r.paid || 0);
      const out = Number(r.outstanding || 0);

      totalBorrowed += orig;
      totalRepaid += paid;
      totalOutstanding += out;
      if (out > 0.005) activeCount++;
    }

    return { totalBorrowed, totalRepaid, totalOutstanding, activeCount };
  }, [rows]);

  // Filtered Rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const isSettled = Number(r.outstanding || 0) <= 0.005;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isSettled) ||
        (statusFilter === 'settled' && isSettled);

      return matchesStatus;
    });
  }, [rows, statusFilter]);

  const controls = useListControls(
    filtered,
    (loan) => `${loan.name} ${loan.description || ''}`,
    (loan) => loan.date
  );

  // Fetch single loan detail
  const openDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/loans/${id}`);
      if (res.ok) {
        const d = await res.json();
        setDetail(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create or Update Loan
  const handleSaveLoan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const body: Record<string, any> = {
      name: fd.get('name'),
      date: fd.get('date'),
      emi: Number(fd.get('emi') || 0),
      nextEmiDate: fd.get('nextEmiDate') || null,
      description: fd.get('description') || null,
    };

    const isEdit = formLoan !== null && formLoan !== undefined;
    if (!isEdit) {
      body.amount = Number(fd.get('amount') || 0);
    } else if (fd.get('amount')) {
      body.originalAmount = Number(fd.get('amount') || 0);
    }

    try {
      const res = await fetch(isEdit ? `/api/loans/${formLoan.id}` : '/api/loans', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save loan.');
      } else {
        setFormLoan(undefined);
        await load();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Record EMI Payment
  const handleRecordPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payLoan) return;

    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));

    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid payment amount.');
      setBusy(false);
      return;
    }

    if (amount > Number(payLoan.outstanding)) {
      setError(`Payment cannot exceed outstanding balance of ${money(payLoan.outstanding)}.`);
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/loans/${payLoan.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fd.get('date'),
          amount,
          method: fd.get('method') || 'Cash',
          notes: fd.get('notes') || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to record payment.');
      } else {
        setPayLoan(null);
        setPayAmount('');
        await load();
        if (detail && detail.loan.id === payLoan.id) {
          await openDetail(payLoan.id);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Delete Loan
  const handleDeleteLoan = async () => {
    if (!deleteLoan) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${deleteLoan.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteLoan(null);
        await load();
        if (detail && detail.loan.id === deleteLoan.id) {
          setDetail(null);
        }
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to delete loan.');
      }
    } catch {
      setError('Network error while deleting loan.');
    } finally {
      setBusy(false);
    }
  };

  // Reverse / Delete Single EMI Payment
  const handleReversePayment = async () => {
    if (!reversePayment) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/loans/${reversePayment.loanId}/payments?paymentId=${reversePayment.payment.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setReversePayment(null);
        await load();
        await openDetail(reversePayment.loanId);
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to reverse payment.');
      }
    } catch {
      alert('Network error while reversing payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="management">
      {/* Header */}
      <header className="management-head no-print">
        <div>
          <p className="eyebrow">FINANCIAL LIABILITIES</p>
          <h1>Loan Management</h1>
          <p>Track loans, EMIs, and repayments.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setError('');
            setFormLoan(null);
          }}
        >
          <Plus size={16} /> <span>Add loan</span>
        </button>
      </header>

      {/* KPI Summary Cards */}
      <section className="loan-summary no-print">
        <div className="loan-stat-card">
          <div className="loan-stat-icon borrowed">
            <Landmark size={20} />
          </div>
          <div className="loan-stat-content">
            <span>Total Borrowed</span>
            <b>{money(summary.totalBorrowed)}</b>
          </div>
        </div>

        <div className="loan-stat-card">
          <div className="loan-stat-icon repaid">
            <CheckCircle2 size={20} />
          </div>
          <div className="loan-stat-content">
            <span>Total Repaid</span>
            <b className="success">{money(summary.totalRepaid)}</b>
          </div>
        </div>

        <div className="loan-stat-card">
          <div className="loan-stat-icon outstanding">
            <AlertCircle size={20} />
          </div>
          <div className="loan-stat-content">
            <span>Outstanding Balance</span>
            <b className="danger">{money(summary.totalOutstanding)}</b>
          </div>
        </div>

        <div className="loan-stat-card">
          <div className="loan-stat-icon active">
            <Calendar size={20} />
          </div>
          <div className="loan-stat-content">
            <span>Active Loans</span>
            <b>
              {summary.activeCount} <small style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>active</small>
            </b>
          </div>
        </div>
      </section>

      {/* Data Panel */}
      <section className="card data-panel no-print">
        {/* Filters and Search */}
        <div className="loan-filters">
          <ListFilters controls={controls} dateFilter placeholder="Search lender or loan notes…" />

          <select
            className="loan-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Loans ({rows.length})</option>
            <option value="active">Active Loans ({rows.filter((r) => Number(r.outstanding) > 0.005).length})</option>
            <option value="settled">Settled Loans ({rows.filter((r) => Number(r.outstanding) <= 0.005).length})</option>
          </select>

          {(controls.hasFilters || statusFilter !== 'all') && (
            <button
              className="outline"
              onClick={() => {
                controls.reset();
                setStatusFilter('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Loan Table */}
        <div className="loan-table">
          <div className="loan-row labels">
            <span>Lender / Loan</span>
            <span>Date</span>
            <span>Original</span>
            <span>Repaid</span>
            <span>Outstanding</span>
            <span>Monthly EMI</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {controls.pageRows.map((x) => {
            const original = Number(x.original || x.outstanding || 0);
            const paid = Number(x.paid || 0);
            const outstanding = Number(x.outstanding || 0);
            const isSettled = outstanding <= 0.005;
            const pct = original > 0 ? Math.min(100, Math.round((paid / original) * 100)) : 100;

            return (
              <div className="loan-row" key={x.id}>
                {/* 1. Header: Lender Name + Mobile Status Badge */}
                <div className="loan-lender-cell">
                  <div className="loan-lender-head-row">
                    <b>{x.name}</b>
                    <span className={`loan-status-badge mobile-only ${isSettled ? 'settled' : 'active'}`}>
                      {isSettled ? 'Settled' : 'Active'}
                    </span>
                  </div>
                  {x.description && <small>{x.description}</small>}
                </div>

                {/* 2. Loan Date (Desktop) */}
                <span className="loan-desktop-cell">{x.date || '—'}</span>

                {/* 3. Original Amount (Desktop) */}
                <span className="loan-desktop-cell">{money(original)}</span>

                {/* 4. Repaid & Progress Bar */}
                <div className="loan-progress-cell">
                  <div className="loan-progress-label">
                    <span>Repaid: {money(paid)}</span>
                    <b>{pct}%</b>
                  </div>
                  <div className="loan-progress-track">
                    <div className="loan-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* 5. Outstanding Balance (Desktop) */}
                <b className={`loan-desktop-cell ${isSettled ? 'success' : 'payable'}`}>
                  {money(outstanding)}
                </b>

                {/* 6. Monthly EMI (Desktop) */}
                <span className="loan-desktop-cell">
                  {Number(x.emi) > 0 ? money(x.emi) : 'Flexible'}
                  {x.nextEmiDate && (
                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>
                      Due: {x.nextEmiDate}
                    </small>
                  )}
                </span>

                {/* 7. Status Badge (Desktop) */}
                <div className="loan-desktop-cell">
                  <span className={`loan-status-badge ${isSettled ? 'settled' : 'active'}`}>
                    {isSettled ? 'Settled' : 'Active'}
                  </span>
                </div>

                {/* Mobile Financial Breakdown Grid (Shows on screens <= 700px) */}
                <div className="loan-mobile-fin-grid">
                  <div className="loan-mobile-tile">
                    <span>Original Loan</span>
                    <b>{money(original)}</b>
                  </div>
                  <div className="loan-mobile-tile">
                    <span>Outstanding Balance</span>
                    <b className={isSettled ? 'success' : 'payable'}>{money(outstanding)}</b>
                  </div>
                  <div className="loan-mobile-tile">
                    <span>Monthly EMI</span>
                    <b>{Number(x.emi) > 0 ? money(x.emi) : 'Flexible'}</b>
                  </div>
                  <div className="loan-mobile-tile">
                    <span>Start / Due</span>
                    <b>{x.nextEmiDate || x.date || '—'}</b>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="row-actions">
                  <button
                    type="button"
                    data-mutation-guard-ignore
                    className="loan-action-btn-main statement"
                    title="View loan statement & ledger"
                    onClick={() => openDetail(x.id)}
                  >
                    <Eye size={15} />
                    <span>Statement</span>
                  </button>

                  {!isSettled && (
                    <button
                      type="button"
                      data-mutation-guard-ignore
                      className="loan-action-btn-main pay"
                      title="Record EMI repayment"
                      onClick={() => {
                        setError('');
                        setPayLoan(x);
                        setPayAmount(x.emi && Number(x.emi) > 0 ? String(x.emi) : '');
                      }}
                    >
                      <WalletCards size={15} />
                      <span>Pay EMI</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-mutation-guard-ignore
                    className="loan-action-icon-btn"
                    title="Edit loan details"
                    onClick={() => {
                      setError('');
                      setFormLoan(x);
                    }}
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    className="loan-action-icon-btn danger"
                    title="Delete loan"
                    onClick={() => {
                      setError('');
                      setDeleteLoan(x);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && controls.filtered.length === 0 && (
            <p className="empty" style={{ padding: '36px 0' }}>
              {rows.length === 0
                ? 'No loans recorded yet. Click "Add loan" to record your first loan.'
                : 'No loans match your search or filter.'}
            </p>
          )}
        </div>
        <div className="list-footer-pagination">
          <ListPagination controls={controls} />
        </div>
      </section>

      {/* CREATE / EDIT LOAN MODAL */}
      {formLoan !== undefined && (
        <div className="modal loan-modal no-print">
          <div className="modal-backdrop" onClick={() => setFormLoan(undefined)} />
          <section className="supplier-form card loan-form-modal">
            <button className="sheet-close" onClick={() => setFormLoan(undefined)}>
              <X />
            </button>
            <h2>{formLoan ? 'Edit Loan' : 'Add New Loan'}</h2>
            <form onSubmit={handleSaveLoan}>
              <div className="loan-form-grid">
                <label className="loan-form-full">
                  Lender / Bank / Loan Name
                  <input
                    name="name"
                    required
                    placeholder="e.g., Emirates Islamic, ABC Finance, Personal Loan"
                    defaultValue={formLoan?.name || ''}
                  />
                </label>

                <label>
                  Loan Date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={formLoan?.date || today}
                  />
                </label>

                <label>
                  {formLoan ? 'Total Loan Amount (AED)' : 'Original Loan Amount (AED)'}
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required={!formLoan}
                    placeholder="0.00"
                    defaultValue={formLoan ? formLoan.original || formLoan.outstanding : ''}
                  />
                </label>

                <label>
                  Minimum Monthly EMI (AED)
                  <input
                    name="emi"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    defaultValue={formLoan?.emi || '0'}
                  />
                </label>

                <label>
                  Next EMI Due Date <small>(optional)</small>
                  <input
                    name="nextEmiDate"
                    type="date"
                    defaultValue={formLoan?.nextEmiDate || ''}
                  />
                </label>

                <label className="loan-form-full">
                  Loan Description / Purpose <small>(optional)</small>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Notes on terms, interest, vehicle number, or purpose..."
                    defaultValue={formLoan?.description || ''}
                  />
                </label>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button className="primary" disabled={busy}>
                {busy
                  ? formLoan
                    ? 'Updating…'
                    : 'Creating…'
                  : formLoan
                    ? 'Update loan'
                    : 'Create loan'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* RECORD EMI PAYMENT MODAL */}
      {payLoan && (
        <div className="modal loan-pay-modal no-print">
          <div className="modal-backdrop" onClick={() => setPayLoan(null)} />
          <section className="supplier-form card loan-form-modal">
            <button className="sheet-close" onClick={() => setPayLoan(null)}>
              <X />
            </button>
            <h2>Record EMI Payment</h2>
            <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '-4px', marginBottom: '14px' }}>
              Recording repayment for <b>{payLoan.name}</b>
            </p>

            {/* Quick helper shortcuts */}
            <div className="payment-quick-helpers">
              {Number(payLoan.emi) > 0 && Number(payLoan.emi) <= Number(payLoan.outstanding) && (
                <button
                  type="button"
                  className="payment-quick-btn"
                  onClick={() => setPayAmount(String(payLoan.emi))}
                >
                  Pay Monthly EMI ({money(payLoan.emi)})
                </button>
              )}
              <button
                type="button"
                className="payment-quick-btn"
                onClick={() => setPayAmount(String(payLoan.outstanding))}
              >
                Pay Full Balance ({money(payLoan.outstanding)})
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="loan-balance-preview">
                <div>
                  <span>Current Outstanding</span>
                  <b>{money(payLoan.outstanding)}</b>
                </div>
                <div>
                  <span>Remaining After Payment</span>
                  <b className="new-bal">
                    {money(
                      Math.max(
                        0,
                        Number(payLoan.outstanding) - (Number(payAmount) > 0 ? Number(payAmount) : 0)
                      )
                    )}
                  </b>
                </div>
              </div>

              <div className="loan-form-grid">
                <label>
                  Payment Date
                  <input name="date" type="date" defaultValue={today} required />
                </label>

                <label>
                  Payment Amount (AED)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={payLoan.outstanding}
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label className="loan-form-full">
                  Payment Method
                  <select name="method" defaultValue="Bank Transfer">
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </label>

                <label className="loan-form-full">
                  Payment Notes / Reference <small>(optional)</small>
                  <input
                    name="notes"
                    placeholder="e.g., Transfer Ref #98765, Cheque #00432, September installment"
                  />
                </label>
              </div>

              {error && <div className="form-error">{error}</div>}

              <button className="primary" disabled={busy}>
                {busy ? 'Recording payment…' : 'Record EMI payment'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* LOAN STATEMENT / LEDGER DETAILS MODAL */}
      {detail && (
        <div className="modal loan-ledger-modal no-print">
          <div className="modal-backdrop" onClick={() => setDetail(null)} />
          <section className="loan-ledger-modal-card card">
            <button className="sheet-close" onClick={() => setDetail(null)} title="Close">
              <X size={18} />
            </button>

            <div className="loan-ledger-modal-head">
              <div className="loan-ledger-title">
                <p className="eyebrow">LOAN LEDGER & STATEMENT</p>
                <h2>{detail.loan.lender}</h2>
              </div>
              <button
                type="button"
                className="loan-download-btn"
                onClick={() => setPrintLoan(detail)}
              >
                <Download size={14} /> Download PDF
              </button>
            </div>

            {detail.loan.description && (
              <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '14px' }}>
                {detail.loan.description}
              </p>
            )}

            {/* Loan Metrics Strip */}
            <div className="loan-ledger-head">
              <span>
                Original Loan
                <b>{money(detail.loan.originalAmount || detail.loan.outstanding)}</b>
              </span>
              <span>
                Outstanding Balance
                <b className="danger">{money(detail.loan.outstanding)}</b>
              </span>
              <span>
                Total Payments
                <b>{detail.payments.length} record{detail.payments.length === 1 ? '' : 's'}</b>
              </span>
              <span>
                Monthly EMI
                <b>{Number(detail.loan.minimumEmi) > 0 ? money(detail.loan.minimumEmi) : 'Flexible'}</b>
              </span>
            </div>

            {/* Payment History Table */}
            <div className="loan-ledger-table-wrap">
              <table className="loan-ledger-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Date</th>
                    <th style={{ width: '120px' }}>Method</th>
                    <th>Notes</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Balance After</th>
                    <th style={{ width: '65px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.paymentDate}</b>
                      </td>
                      <td>
                        <span className="loan-method-badge">{p.method || 'Cash'}</span>
                      </td>
                      <td style={{ color: p.notes ? 'var(--ink)' : 'var(--muted)' }}>
                        {p.notes || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        {money(p.amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                        {money(p.balanceAfter !== undefined ? p.balanceAfter : 0)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-reverse-payment"
                          title="Reverse this EMI payment"
                          onClick={() => setReversePayment({ loanId: detail.loan.id, payment: p })}
                        >
                          <Undo2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {detail.payments.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        No repayments recorded yet for this loan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="loan-ledger-footer">
              <div>
                {Number(detail.loan.outstanding) <= 0.005 ? (
                  <span className="loan-status-badge settled">Loan Fully Settled</span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Remaining Balance: <b style={{ color: '#dc2626', fontSize: '13px' }}>{money(detail.loan.outstanding)}</b>
                  </span>
                )}
              </div>

              <div className="loan-footer-actions">
                <button
                  type="button"
                  className="loan-btn-secondary"
                  onClick={() => setDetail(null)}
                >
                  Close
                </button>
                {Number(detail.loan.outstanding) > 0.005 && (
                  <button
                    type="button"
                    data-mutation-guard-ignore
                    className="primary"
                    style={{ height: '38px', padding: '0 16px', fontSize: '12px' }}
                    onClick={() => {
                      const row = rows.find((r) => r.id === detail.loan.id);
                      if (row) {
                        setPayLoan(row);
                        setPayAmount(row.emi && Number(row.emi) > 0 ? String(row.emi) : '');
                      }
                    }}
                  >
                    <WalletCards size={15} /> Record Payment
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* CONFIRM DELETE LOAN MODAL */}
      {deleteLoan && (
        <div className="modal loan-confirm-modal no-print">
          <div className="modal-backdrop" onClick={() => setDeleteLoan(null)} />
          <section className="loan-confirm-card card">
            <div className="loan-confirm-icon delete">
              <Trash2 size={22} />
            </div>
            <h2>Delete Loan?</h2>
            <p className="loan-confirm-desc">
              Are you sure you want to permanently delete <b>{deleteLoan.name}</b> and its{' '}
              <b>{deleteLoan.payments}</b> payment record(s)? This action cannot be undone.
            </p>
            {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}
            <div className="loan-confirm-actions">
              <button
                type="button"
                className="loan-confirm-btn cancel"
                onClick={() => setDeleteLoan(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="loan-confirm-btn delete"
                disabled={busy}
                onClick={handleDeleteLoan}
              >
                {busy ? 'Deleting…' : 'Delete Loan'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* CONFIRM REVERSE PAYMENT MODAL */}
      {reversePayment && (
        <div className="modal loan-confirm-modal no-print">
          <div className="modal-backdrop" onClick={() => setReversePayment(null)} />
          <section className="loan-confirm-card card">
            <div className="loan-confirm-icon reverse">
              <Undo2 size={22} />
            </div>
            <h2>Reverse Payment?</h2>
            <p className="loan-confirm-desc">
              Are you sure you want to reverse the repayment of <b>{money(reversePayment.payment.amount)}</b> made on{' '}
              <b>{reversePayment.payment.paymentDate}</b>?
            </p>
            <div className="loan-confirm-note">
              The amount of <b>{money(reversePayment.payment.amount)}</b> will be automatically restored to the loan outstanding balance.
            </div>
            <div className="loan-confirm-actions">
              <button
                type="button"
                className="loan-confirm-btn cancel"
                onClick={() => setReversePayment(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="loan-confirm-btn reverse"
                disabled={busy}
                onClick={handleReversePayment}
              >
                {busy ? 'Reversing…' : 'Reverse Payment'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* PRINTABLE LOAN STATEMENT */}
      {printLoan && (
        <section ref={loanPrintRef} className="print-bill" style={{ display: 'block' }}>
          <div className="bill-header">
            <Image src="/images/logo.webp" alt="Veg Basket" width={72} height={80} priority />
            <div>
              <h1>Veg Basket</h1>
              <p>UAE Vegetable Trading ERP</p>
            </div>
            <div>
              <h2>Loan Statement</h2>
              <p>Date: {today}</p>
            </div>
          </div>

          <div className="bill-meta">
            <div>
              <b>Lender / Entity</b>
              <strong>{printLoan.loan.lender}</strong>
              <span>Start Date: {printLoan.loan.loanDate}</span>
              {printLoan.loan.description && <span>Note: {printLoan.loan.description}</span>}
            </div>
            <div>
              <b>Monthly EMI</b>
              <strong>
                {Number(printLoan.loan.minimumEmi) > 0 ? money(printLoan.loan.minimumEmi) : 'Flexible'}
              </strong>
              {printLoan.loan.nextEmiDate && <span>Next Due: {printLoan.loan.nextEmiDate}</span>}
            </div>
          </div>

          <div className="bill-summary" style={{ gridTemplateColumns: 'repeat(3, 1fr)', margin: '20px 0' }}>
            <span>
              Original Loan
              <strong>{money(printLoan.loan.originalAmount || printLoan.loan.outstanding)}</strong>
            </span>
            <span>
              Total Repaid
              <strong style={{ color: '#059669' }}>
                {money(
                  printLoan.payments.reduce((sum, p) => sum + Number(p.amount), 0)
                )}
              </strong>
            </span>
            <span>
              Outstanding Balance
              <strong style={{ color: '#dc2626' }}>{money(printLoan.loan.outstanding)}</strong>
            </span>
          </div>

          <h3 style={{ fontSize: '13px', margin: '18px 0 8px', color: 'var(--ink)' }}>Repayment History</h3>
          <div className="sale-item-table" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payment Method</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {printLoan.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paymentDate}</td>
                    <td>{p.method || 'Cash'}</td>
                    <td>{p.notes || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.amount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {money(p.balanceAfter !== undefined ? p.balanceAfter : 0)}
                    </td>
                  </tr>
                ))}
                {printLoan.payments.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>
                      No repayments recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer style={{ marginTop: '30px' }}>
            Generated by Veg Basket ERP System · All amounts in AED
          </footer>

          <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="primary" onClick={() => loanPrintRef.current && downloadPdfFromElement(loanPrintRef.current, `${printLoan.loan.lender}-loan-statement.pdf`)}>
              <Download size={16} /> Download PDF
            </button>
            <button className="outline" onClick={() => setPrintLoan(null)}>
              Close
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
