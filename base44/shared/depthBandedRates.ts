// ============================================================
// Depth-Banded Per-Metre Drilling Rate Engine
// ============================================================
// Single source of truth for pricing drilling metres by depth band.
// Used by BOTH:
//   • calculateJobFinancials — per-borehole revenue + profitability
//   • afpPopulation (bulkPopulateAFP) — AFP drilling line-item pricing
//
// EWR/Phenna rate cards price per-metre drilling by depth band AND diameter:
//   "4 — Advance borehole between existing ground level and 10m depth 150mm" → 0–10m, 150mm
//   "5 — As Item B4 but between 10m and 20m depth 150mm"                       → 10–20m, 150mm
// This module parses those descriptions into structured bands and prices
// a depth range by splitting it into 10m bands and summing per-band revenue.

import type { RateCardItemLike } from './jobRateMatcher.ts';

export interface DepthBandedRate {
  depth_from: number;
  depth_to: number;
  diameter: number;
  price: number;
  description: string;
  id: string;
  source: string;
}

export interface BoreholeBand {
  depth_from: number;
  depth_to: number;
  diameter: number;
  metres: number;
  rate_per_metre: number;
  rate_description: string;
  rate_source: string;
  revenue: number;
}

export interface BoreholeRevenue {
  borehole_ref: string;
  method: string;
  metres: number;
  entries: number;
  rate_per_metre: number;
  rate_description: string;
  rate_source: string;
  revenue: number;
  bands: BoreholeBand[];
}

export const DEFAULT_CP_DIAMETER = 150;
export const DEFAULT_ROTARY_DIAMETER = 100;

// Parse depth-banded rate card items into structured bands.
// Filters to per-metre "advance borehole" items in the given method prefix
// (CP Drilling / Rotary Drilling) and extracts depth + diameter from the
// description text.
export function parseDepthBandedRates(
  pool: RateCardItemLike[],
  methodPrefix: string,
  source: string,
): DepthBandedRate[] {
  if (!pool || pool.length === 0) return [];
  const banded = pool.filter(
    (i) =>
      i.unit === 'm' &&
      i.price != null &&
      !isNaN(Number(i.price)) &&
      String(i.subcategory || '').includes(methodPrefix) &&
      /advance borehole|as item b\d|rotary drill/i.test(i.description) &&
      !/backfill|standpipe|install|grout|piezo|inclined|extra over|setting up|standing|break out/i.test(
        i.description,
      ),
  );
  const rates: DepthBandedRate[] = [];
  for (const i of banded) {
    const d = String(i.description || '');
    let m = d.match(/between\s+(\d+)m\s+and\s+(\d+)m\s+depth\s+(\d+)mm/i);
    if (m) {
      rates.push({ depth_from: +m[1], depth_to: +m[2], diameter: +m[3], price: Number(i.price), description: i.description, id: i.id, source });
      continue;
    }
    m = d.match(/between existing ground level and\s+(\d+)m\s+depth\s+(\d+)mm/i);
    if (m) {
      rates.push({ depth_from: 0, depth_to: +m[1], diameter: +m[2], price: Number(i.price), description: i.description, id: i.id, source });
      continue;
    }
    m = d.match(/less than\s+(\d+)m.*?(\d+)mm/i);
    if (m) {
      rates.push({ depth_from: 0, depth_to: +m[1], diameter: +m[2], price: Number(i.price), description: i.description, id: i.id, source });
      continue;
    }
  }
  const seen = new Set<string>();
  return rates
    .filter((r) => {
      const key = `${r.depth_from}-${r.depth_to}-${r.diameter}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.depth_from - b.depth_from || a.diameter - b.diameter);
}

// Single-rate fallback for rate cards without depth bands.
export function findPerMetreDrillingRate(method: string, pool: RateCardItemLike[]): RateCardItemLike | null {
  if (!pool || pool.length === 0) return null;
  const methodPrefix = method === 'rotary' ? 'Rotary Drilling' : 'CP Drilling';
  const perMetre = pool.filter(
    (i) => i.unit === 'm' && i.price != null && !isNaN(Number(i.price)) && String(i.subcategory || '').includes(methodPrefix),
  );
  if (perMetre.length === 0) return null;
  const advance = perMetre.filter(
    (i) => /advance borehole|rotary drill/i.test(i.description) && !/backfill|standpipe|install|grout|piezo|inclined|extra over/i.test(i.description),
  );
  return advance[0] || perMetre[0];
}

// Split a depth range into 10m bands (or any band size).
// Returns a map of "from-to" → metres in that band.
export function splitDepthIntoBands(dFrom: number, dTo: number, bandSize = 10): Record<string, number> {
  const bands: Record<string, number> = {};
  let bandStart = Math.floor(dFrom / bandSize) * bandSize;
  while (bandStart < dTo) {
    const segFrom = Math.max(bandStart, dFrom);
    const segTo = Math.min(bandStart + bandSize, dTo);
    if (segTo > segFrom) {
      const key = `${bandStart}-${bandStart + bandSize}`;
      bands[key] = Math.round(((bands[key] || 0) + (segTo - segFrom)) * 100) / 100;
    }
    bandStart += bandSize;
  }
  return bands;
}

// Price a single drilling log's depth range against the banded rates.
// Returns { rate, amount, rate_description, rate_source }.
// Used by the AFP builder to price individual drilling logs correctly.
export function priceDrillingLog(
  depthFrom: number,
  depthTo: number,
  method: string,
  bandedRates: DepthBandedRate[],
  singleRate: RateCardItemLike | null,
  jobMeterageRate: number = 0,
): { rate: number; amount: number; rate_description: string; rate_source: string } {
  const metres = Math.round((depthTo - depthFrom) * 100) / 100;
  if (metres <= 0) return { rate: 0, amount: 0, rate_description: '', rate_source: 'no_match' };

  // Job fixed metre rate takes precedence
  if (jobMeterageRate > 0) {
    return {
      rate: jobMeterageRate,
      amount: Math.round(metres * jobMeterageRate * 100) / 100,
      rate_description: 'Job metre rate',
      rate_source: 'job',
    };
  }

  // Depth-banded pricing
  if (bandedRates.length > 0) {
    const defaultDiameter = method === 'rotary' ? DEFAULT_ROTARY_DIAMETER : DEFAULT_CP_DIAMETER;
    const bands = splitDepthIntoBands(depthFrom, depthTo);
    let totalRevenue = 0;
    let lastRate = 0;
    let lastDesc = '';
    let lastSource = 'no_match';
    for (const [bandKey, bandMetres] of Object.entries(bands)) {
      const [bf, bt] = bandKey.split('-').map(Number);
      const exactMatch = bandedRates.find((r) => r.depth_from === bf && r.depth_to === bt && r.diameter === defaultDiameter);
      const anyDiameter = bandedRates.find((r) => r.depth_from === bf && r.depth_to === bt);
      const rate = exactMatch || anyDiameter;
      const ratePerM = rate ? rate.price : 0;
      totalRevenue += Math.round(bandMetres * ratePerM * 100) / 100;
      if (rate) {
        lastRate = ratePerM;
        lastDesc = rate.description;
        lastSource = rate.source;
      }
    }
    return {
      rate: lastRate,
      amount: Math.round(totalRevenue * 100) / 100,
      rate_description: lastDesc || `Depth-banded ${method}`,
      rate_source: lastSource,
    };
  }

  // Single-rate fallback
  if (singleRate) {
    const ratePerM = Number(singleRate.price) || 0;
    return {
      rate: ratePerM,
      amount: Math.round(metres * ratePerM * 100) / 100,
      rate_description: singleRate.description || `Per metre ${method}`,
      rate_source: (singleRate as any).source || 'rate_card',
    };
  }

  return { rate: 0, amount: 0, rate_description: 'No rate found', rate_source: 'no_match' };
}

// Load and prepare depth-banded rate tables for a job.
// Returns { cpBandedRates, rotaryBandedRates, cpSingleRate, rotarySingleRate }
// so the caller can price any borehole by method without re-loading.
export async function loadDrillingRateCards(
  base44: any,
  jobId: string,
  jobMeterageRate: number = 0,
): Promise<{
  cpBandedRates: DepthBandedRate[];
  rotaryBandedRates: DepthBandedRate[];
  cpSingleRate: RateCardItemLike | null;
  rotarySingleRate: RateCardItemLike | null;
  jobMeterageRate: number;
}> {
  let jobRateItems: RateCardItemLike[] = [];
  let globalItems: RateCardItemLike[] = [];
  try {
    jobRateItems = await base44.asServiceRole.entities.RateCardItem.filter(
      { job_id: jobId, is_active: true }, 'sort_order', 500,
    );
  } catch (_) {}
  try {
    globalItems = await base44.asServiceRole.entities.RateCardItem.filter(
      { rate_card_source: 'our_company', is_active: true, job_id: null }, 'sort_order', 1000,
    );
  } catch (_) {}

  const cpBandedRates: DepthBandedRate[] = [
    ...parseDepthBandedRates(jobRateItems, 'CP Drilling', 'job'),
    ...parseDepthBandedRates(globalItems, 'CP Drilling', 'global'),
  ];
  const rotaryBandedRates: DepthBandedRate[] = [
    ...parseDepthBandedRates(jobRateItems, 'Rotary Drilling', 'job'),
    ...parseDepthBandedRates(globalItems, 'Rotary Drilling', 'global'),
  ];
  const cpSingleRate = findPerMetreDrillingRate('cp', jobRateItems) || findPerMetreDrillingRate('cp', globalItems);
  const rotarySingleRate = findPerMetreDrillingRate('rotary', jobRateItems) || findPerMetreDrillingRate('rotary', globalItems);

  return { cpBandedRates, rotaryBandedRates, cpSingleRate, rotarySingleRate, jobMeterageRate };
}

// Determine the drilling method for a borehole from its logs.
// Returns 'cp', 'rotary', or '' (unknown).
export function inferBoreholeMethod(logs: any[]): string {
  let hasCore = false;
  let hasCp = false;
  for (const l of logs) {
    if (l.log_type === 'core_inspection') hasCore = true;
    if (l.log_type === 'borehole_progress' || l.log_type === 'sample_collection' || l.log_type === 'window_sampling') hasCp = true;
    if (l.drilling_method === 'cp') hasCp = true;
    if (l.drilling_method === 'rotary') hasCore = true;
  }
  if (hasCore && !hasCp) return 'rotary';
  if (hasCp && !hasCore) return 'cp';
  if (hasCore && hasCp) return 'rotary'; // mixed → use rotary (core runs are the deeper, more expensive part)
  return '';
}