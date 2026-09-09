/**
 * financialStats.js — single source of truth for all financial KPI calculations.
 *
 * Every financial stat box across the app (Billing Hub, Admin Dashboard,
 * Enterprise Financial Hub, Job Financials) imports these functions so the
 * numbers mean the same thing and add up correctly on every surface.
 *
 * Unified definitions (agreed across all surfaces):
 *  - Outstanding: invoices where status is 'sent' or 'overdue' (excludes draft, paid, void)
 *  - Overdue:     invoices where status is 'overdue' OR (status is 'sent' and due_date < today)
 *  - Collected:   invoices where status is 'paid' (same as Revenue)
 *  - Total Invoiced: all non-void invoices (draft + sent + overdue + paid)
 *  - Draft:       invoices where status is 'draft'
 *
 * All amounts use gross_total (the full amount including VAT) for consistency.
 * net_total is only used for VAT-specific calculations (getVatLiability).
 */

const isOverdue = (inv, now = new Date()) => {
  if (inv.status === 'overdue') return true;
  if (inv.status === 'sent' && inv.due_date) {
    return new Date(inv.due_date + 'T00:00:00') < now;
  }
  return false;
};

const isOutstanding = (inv) => inv.status === 'sent' || inv.status === 'overdue';

const isNonVoid = (inv) => inv.status && inv.status !== 'void';

const sumGross = (invoices) => invoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

/** Outstanding = sent + overdue invoices (gross_total). Excludes draft, paid, void. */
export const getOutstanding = (invoices) => {
  const list = (invoices || []).filter(isOutstanding);
  return { amount: sumGross(list), count: list.length, invoices: list };
};

/** Overdue = status 'overdue' OR status 'sent' with due_date in the past (gross_total). */
export const getOverdue = (invoices) => {
  const now = new Date();
  const list = (invoices || []).filter(inv => isOverdue(inv, now));
  return { amount: sumGross(list), count: list.length, invoices: list };
};

/** Collected = paid invoices (gross_total). Same as Revenue. */
export const getCollected = (invoices) => {
  const list = (invoices || []).filter(i => i.status === 'paid');
  return { amount: sumGross(list), count: list.length, invoices: list };
};

/** Total Invoiced = all non-void invoices (gross_total). Includes draft, sent, overdue, paid. */
export const getTotalInvoiced = (invoices) => {
  const list = (invoices || []).filter(isNonVoid);
  return { amount: sumGross(list), count: list.length, invoices: list };
};

/** Draft = invoices with status 'draft' (gross_total). */
export const getDraftInvoices = (invoices) => {
  const list = (invoices || []).filter(i => i.status === 'draft');
  return { amount: sumGross(list), count: list.length, invoices: list };
};

/** VAT Liability = VAT on outstanding (sent + overdue) invoices — owed to HMRC but not yet paid. */
export const getVatLiability = (invoices) => {
  const list = (invoices || []).filter(isOutstanding);
  return list.reduce((s, i) => s + (Number(i.vat_total) || 0), 0);
};

/**
 * AFP Pipeline = AFPs that are in the billing workflow (draft, pending_review, or submitted).
 * Returns the total claimed value and count.
 */
export const getAfPPipeline = (afps) => {
  const list = (afps || []).filter(a =>
    a.status === 'draft' || a.status === 'pending_review' || a.status === 'submitted'
  );
  const amount = list.reduce((s, a) => s + (Number(a.total_claimed) || 0), 0);
  const agreed = list.reduce((s, a) => s + (Number(a.agreed_total) || 0), 0);
  return { amount, agreed, count: list.length, afps: list };
};

/**
 * Convenience: compute all KPIs from a single invoice array in one pass.
 * Returns { outstanding, overdue, collected, totalInvoiced, draft, vatLiability }
 * — each with { amount, count } except vatLiability (number).
 */
export const computeAllFinancialKPIs = (invoices) => {
  const outstanding = getOutstanding(invoices);
  const overdue = getOverdue(invoices);
  const collected = getCollected(invoices);
  const totalInvoiced = getTotalInvoiced(invoices);
  const draft = getDraftInvoices(invoices);
  const vatLiability = getVatLiability(invoices);
  return { outstanding, overdue, collected, totalInvoiced, draft, vatLiability };
};