// ============================================================
// Unified Rate Resolver — the single source of truth for pricing
// ============================================================
// Resolution hierarchy (highest priority wins):
//   1. CONTRACT SNAPSHOT — an active JobBillingContract's rate_snapshot JSON.
//      Frozen at activation so invoices never drift when rate cards change.
//   2. JOB RATE CARD — RateCardItem where job_id == the job's own id.
//   3. GLOBAL MASTER LIST — RateCardItem where job_id is null and
//      rate_card_source == 'our_company'.
//
// Every resolution returns a `rate_source` tag ('contract_snapshot' |
// 'project_rate_card' | 'global_master' | 'no_match') so callers can
// stamp the provenance on each charged record for audit transparency.
//
// Used by:
//   • stampBillingCharge  — auto-prices newly created cost logs
//   • calculateCharge      — interactive charge calculation endpoint
//   • autoGenerateInvoice  — line-item assembly for draft invoices
//
// This module supersedes the ad-hoc project rate card lookups that were
// duplicated across calculateCharge and stampBillingCharge. Import this
// instead of calling loadProjectRateCardItems / resolveProjectCharge directly.

import {
  loadJobRateCardItems,
  resolveJobCharge,
  findBestRateCardMatch,
  type RateCardItemLike,
} from './jobRateMatcher.ts';

export type RateSource =
  | 'contract_snapshot'
  | 'job_rate_card'
  | 'global_master'
  | 'no_match';

export interface ResolvedRate {
  rate_card_item_id: string | null;
  description: string;
  unit_price: number;
  quantity: number;
  total: number;
  unit: string | null;
  subcategory: string | null;
  category: string | null;
  rate_source: RateSource;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Level 1: Contract Snapshot ──
// Parse the frozen rate_snapshot JSON from an active JobBillingContract
// and match against it. Snapshot items are lightweight clones of RateCardItem
// (id, description, price, unit, subcategory, category, etc.).
export function resolveFromSnapshot(
  description: string,
  snapshotJson: string | null | undefined,
  quantity: number = 1,
): ResolvedRate | null {
  if (!snapshotJson) return null;
  let snapshot: any;
  try {
    snapshot = typeof snapshotJson === 'string' ? JSON.parse(snapshotJson) : snapshotJson;
  } catch (_) {
    return null;
  }
  const items: RateCardItemLike[] = (snapshot?.items || []).map((i: any) => ({
    id: i.id,
    description: i.description,
    price: i.price ?? null,
    price_text: i.price_text || null,
    cost_price: i.cost_price ?? null,
    unit: i.unit || null,
    subcategory: i.subcategory || null,
    job_id: null, // snapshot is job-agnostic
    is_active: true,
    // Extra fields for category filtering
    ...i,
  }));
  const item = findBestRateCardMatch(description, items);
  if (!item) return null;
  const unitPrice = Number(item.price) || 0;
  const qty = Number(quantity) || 1;
  return {
    rate_card_item_id: item.id,
    description: item.description,
    unit_price: unitPrice,
    quantity: qty,
    total: round2(unitPrice * qty),
    unit: item.unit || null,
    subcategory: item.subcategory || null,
    category: (item as any).category || null,
    rate_source: 'contract_snapshot',
  };
}

// ── Level 2 + 3: Job / Global rate card ──
// Uses loadJobRateCardItems which already implements the job → global
// fallback internally.
export async function resolveFromRateCards(
  base44: any,
  jobId: string | null | undefined,
  description: string,
  quantity: number = 1,
  jobDate?: string | null,
): Promise<ResolvedRate | null> {
  const items = await loadJobRateCardItems(base44, jobId, jobDate);
  const match = resolveJobCharge(description, items, quantity);
  if (!match) return null;
  const source: RateSource = jobId && items.length > 0 && items.some((i) => i.job_id === jobId)
    ? 'job_rate_card'
    : 'global_master';
  return {
    rate_card_item_id: match.rateCardItem.id,
    description: match.rateCardItem.description,
    unit_price: match.unitPrice,
    quantity: match.quantity,
    total: match.total,
    unit: match.rateCardItem.unit || null,
    subcategory: match.rateCardItem.subcategory || null,
    category: (match.rateCardItem as any).category || null,
    rate_source: source,
  };
}

// ── BillingRule locked rate card resolution ──
// When a BillingRule has locked_rate_card_item_id set, use that RateCardItem
// directly without fuzzy matching. This is the manual override mechanism that
// prevents fragile text matches from breaking when rate card wording changes.
export async function resolveFromLockedRateCard(
  base44: any,
  lockedRateCardItemId: string,
  quantity: number = 1,
): Promise<ResolvedRate | null> {
  if (!lockedRateCardItemId) return null;
  try {
    const item: any = await base44.entities.RateCardItem.get(lockedRateCardItemId);
    if (!item) return null;
    const unitPrice = Number(item.price) || 0;
    const qty = Number(quantity) || 1;
    return {
      rate_card_item_id: item.id,
      description: item.description,
      unit_price: unitPrice,
      quantity: qty,
      total: round2(unitPrice * qty),
      unit: item.unit || null,
      subcategory: item.subcategory || null,
      category: (item as any).category || null,
      rate_source: 'global_master',
    };
  } catch (_) {
    return null;
  }
}

// ── Resolve from a BillingRule (with locked override) ──
// If the BillingRule has locked_rate_card_item_id, use it directly.
// Otherwise, fall through to the normal resolveRate flow.
export async function resolveFromBillingRule(
  base44: any,
  billingRule: any,
  params: {
    job_id: string;
    description: string;
    quantity?: number;
    activeContract?: { rate_snapshot?: string | null } | null;
    job_date?: string | null;
  },
): Promise<ResolvedRate | null> {
  // Check locked rate card first (manual override)
  if (billingRule?.locked_rate_card_item_id) {
    const locked = await resolveFromLockedRateCard(base44, billingRule.locked_rate_card_item_id, params.quantity);
    if (locked) return locked;
  }
  // Fall through to normal resolution (contract snapshot → job rate card → global master)
  return resolveRate(base44, params);
}

// ── Master resolver — the single entry point ──
// Tries contract snapshot first, then falls back to live rate cards.
// Pass an optional activeContract object (with rate_snapshot) to enable
// Level 1 resolution; pass null to skip straight to rate cards.
export async function resolveRate(
  base44: any,
  params: {
    job_id: string;
    description: string;
    quantity?: number;
    activeContract?: { rate_snapshot?: string | null } | null;
    job_date?: string | null;
  },
): Promise<ResolvedRate | null> {
  const { description, quantity, activeContract, job_id, job_date } = params;
  if (!description) return null;

  // Level 1 — contract snapshot
  if (activeContract?.rate_snapshot) {
    const snapshotMatch = resolveFromSnapshot(description, activeContract.rate_snapshot, quantity);
    if (snapshotMatch) return snapshotMatch;
  }

  // Level 2 + 3 — job / global rate cards (filtered by effective date)
  return resolveFromRateCards(base44, job_id, description, quantity, job_date);
}

// ── Load the active contract for a job ──
// Returns the highest-version active JobBillingContract, or null.
export async function loadActiveContract(
  base44: any,
  jobId: string,
): Promise<{ id: string; rate_snapshot: string | null; version: number } | null> {
  try {
    const contracts = await base44.entities.JobBillingContract.filter({ job_id: jobId, status: 'active' });
    if (!contracts || contracts.length === 0) return null;
    // Highest version wins
    const sorted = contracts.sort((a: any, b: any) => (b.version || 0) - (a.version || 0));
    return {
      id: sorted[0].id,
      rate_snapshot: sorted[0].rate_snapshot || null,
      version: sorted[0].version || 1,
    };
  } catch (_) {
    return null;
  }
}