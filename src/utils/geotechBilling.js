// Geotechnical billing calculations for AGS-imported (KeyLogBook) investigation data.
// Aggregates borehole metres, samples, SPT tests, core runs and installations per job,
// and matches depth bands against the InvestigationSOR schedule of rates so the
// billing team can see exactly what was drilled and what it costs.

// Infer borehole status when LOCA_STAT is missing or blank.
// Priority: explicit LOCA_STAT → end date + final depth → data coverage fallback.
// Mirrors the logic in base44/shared/boreholeStatus.ts (used by the importAGS backend function).
export function inferBoreholeStatus({ locaStatRaw, finalDepth, endDate, startDate, strataCount, sampleCount, coreCount }) {
  const raw = (locaStatRaw || '').toUpperCase().trim();
  if (raw === 'COMPLETE' || raw === 'COMPLETED' || raw === 'C') return 'complete';
  if (raw === 'INPROG' || raw === 'IN_PROGRESS' || raw === 'IN-PROG' || raw === 'I') return 'in_progress';
  if (raw === 'UNCHECKED' || raw === 'UNCK' || raw === 'U') return 'unchecked';

  const hasFinalDepth = finalDepth != null && finalDepth > 0;
  const hasEndDate = !!endDate;
  if (hasFinalDepth && hasEndDate) return 'complete';
  if (startDate && !hasEndDate) return 'in_progress';

  const dataCount = (strataCount || 0) + (sampleCount || 0) + (coreCount || 0);
  if (dataCount === 0) return 'unchecked';
  return 'in_progress';
}

// Sum the final drilled depth per borehole (max depth_to across all AGS logs for that ref).
export function getTotalMetres(invLogs) {
  const byRef = {};
  (invLogs || [])
    .filter((l) => l.source === 'ags_import' && l.borehole_ref && l.depth_to != null)
    .forEach((l) => {
      if (byRef[l.borehole_ref] == null || l.depth_to > byRef[l.borehole_ref]) {
        byRef[l.borehole_ref] = l.depth_to;
      }
    });
  return Object.values(byRef).reduce((s, d) => s + d, 0);
}

// Parse a depth band from an SOR description string.
// "between 30 and 40 m depth"        -> { from: 30, to: 40 }
// "between ground level and 10 m"    -> { from: 0, to: 10 }
// Returns null when no band can be parsed.
export function parseDepthBand(description) {
  if (!description) return null;
  const d = description.toLowerCase();
  let m;
  // "between existing ground level / ground level and N m"
  m = d.match(/between\s+(?:existing ground level|ground level|0)\s+and\s+(\d+(?:\.\d+)?)\s*m/);
  if (m) return { from: 0, to: parseFloat(m[1]) };
  // "between N and M m"
  m = d.match(/between\s+(\d+(?:\.\d+)?)\s+(?:and|to|-)\s+(\d+(?:\.\d+)?)\s*m/);
  if (m) return { from: parseFloat(m[1]), to: parseFloat(m[2]) };
  return null;
}

// Build the list of priced SOR depth-band items (those with a numeric price).
// Each entry: { item, from, to, price, description, item_ref, unit }
export function getSorDepthBands(sorItems) {
  return (sorItems || [])
    .map((item) => {
      const band = parseDepthBand(item.description);
      if (!band) return null;
      return {
        id: item.id,
        item_ref: item.item_ref || '',
        description: item.description,
        sheet_name: item.sheet_name || '',
        unit: item.unit || 'm',
        from: band.from,
        to: band.to,
        price: item.price,
        price_text: item.price_text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.from - b.from);
}

// Allocate a borehole's total depth across standard 10m bands.
// Returns [{ from, to, metres }] for bands that have any metres.
export function allocateDepthBands(totalDepth, bandSize = 10) {
  const bands = [];
  if (!totalDepth || totalDepth <= 0) return bands;
  const maxBand = Math.ceil(totalDepth / bandSize);
  for (let i = 0; i < maxBand; i++) {
    const from = i * bandSize;
    const to = (i + 1) * bandSize;
    const metres = Math.max(0, Math.min(totalDepth, to) - Math.min(totalDepth, from));
    if (metres > 0) bands.push({ from, to, metres: Math.round(metres * 100) / 100 });
  }
  return bands;
}

// Full aggregation of geotechnical data for a job from its AGS-imported logs.
export function aggregateGeotech(invLogs) {
  const ags = (invLogs || []).filter((l) => l.source === 'ags_import');
  if (ags.length === 0) return null;

  // Boreholes — group by ref, capture final depth + groundwater
  const boreholeMap = {};
  ags.forEach((l) => {
    if (!l.borehole_ref) return;
    if (!boreholeMap[l.borehole_ref]) {
      boreholeMap[l.borehole_ref] = { ref: l.borehole_ref, maxDepth: 0, groundwater: null };
    }
    if (l.depth_to != null && l.depth_to > boreholeMap[l.borehole_ref].maxDepth) {
      boreholeMap[l.borehole_ref].maxDepth = l.depth_to;
    }
    if (l.groundwater_strike_depth != null) {
      boreholeMap[l.borehole_ref].groundwater = l.groundwater_strike_depth;
    }
  });
  const boreholes = Object.values(boreholeMap).sort((a, b) => a.ref.localeCompare(b.ref));
  const totalMetres = boreholes.reduce((s, b) => s + b.maxDepth, 0);

  // Samples
  const sampleLogs = ags.filter((l) => l.log_type === 'sample_collection');
  const samples = { disturbed: 0, undisturbed: 0, water: 0, none: 0, total: sampleLogs.length };
  sampleLogs.forEach((l) => {
    const t = l.sample_type || 'none';
    samples[t] = (samples[t] || 0) + 1;
  });

  // SPT
  const sptLogs = ags.filter((l) => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0));
  const sptNValues = sptLogs.map((l) => l.spt_n_value).filter((n) => n != null);

  // Core runs
  const coreLogs = ags.filter((l) => l.log_type === 'core_inspection');
  const recoveries = coreLogs.map((l) => l.coring_recovery).filter((r) => r != null);
  const rqds = coreLogs.map((l) => l.coring_rqd).filter((r) => r != null);

  // Installations + water readings
  const installations = ags.filter((l) => l.log_type === 'installation').length;
  const waterReadings = ags.filter((l) => l.log_type === 'standpipe_reading').length;

  // Depth-band distribution across all boreholes
  const bandTotals = {};
  boreholes.forEach((b) => {
    allocateDepthBands(b.maxDepth).forEach((band) => {
      const key = `${band.from}-${band.to}`;
      bandTotals[key] = (bandTotals[key] || 0) + band.metres;
    });
  });
  const depthBands = Object.entries(bandTotals)
    .map(([key, metres]) => {
      const [from, to] = key.split('-').map(Number);
      return { from, to, metres: Math.round(metres * 100) / 100 };
    })
    .sort((a, b) => a.from - b.from);

  return {
    boreholes,
    totalMetres: Math.round(totalMetres * 100) / 100,
    samples,
    sptCount: sptLogs.length,
    sptNValues,
    coreRuns: coreLogs.length,
    avgRecovery: recoveries.length ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null,
    avgRqd: rqds.length ? Math.round(rqds.reduce((a, b) => a + b, 0) / rqds.length) : null,
    installations,
    waterReadings,
    depthBands,
  };
}

// Calculate the geotechnical charge for a job.
// Primary: job.meterage_rate × total metres (the per-metre contract rate).
// Detail: metres per depth band matched to SOR depth items (priced where available).
// Samples: count × sample unit price (if a rate card sample item exists).
export function calculateGeotechCost(job, geotech, sorDepthBands, sampleRateItems) {
  if (!geotech) return null;

  const meterageRate = Number(job?.meterage_rate) || 0;
  const meterageRevenue = geotech.totalMetres * meterageRate;

  // Match each depth band to the best SOR item (same from/to range).
  const bandBreakdown = geotech.depthBands.map((band) => {
    const sor = sorDepthBands.find((s) => s.from === band.from && s.to === band.to);
    const price = sor?.price;
    const isPriced = price != null;
    return {
      ...band,
      sorRef: sor?.item_ref || '',
      sorDescription: sor?.description || '',
      sorPrice: price,
      sorPriceText: sor?.price_text,
      isPriced,
      lineCost: isPriced ? Math.round(band.metres * price * 100) / 100 : null,
    };
  });

  // Sample costing — match rate card items by sample type keyword.
  const samplePricing = [
    { type: 'undisturbed', keywords: ['undisturbed', 'uds', 'u100', 'u-100'] },
    { type: 'disturbed', keywords: ['disturbed', 'sp', 'small disturbed'] },
    { type: 'water', keywords: ['water sample', 'groundwater sample'] },
  ].map(({ type, keywords }) => {
    const rate = (sampleRateItems || []).find((r) => {
      const desc = (r.description || '').toLowerCase();
      return keywords.some((k) => desc.includes(k));
    });
    const count = geotech.samples[type] || 0;
    const unitPrice = rate?.price ?? null;
    return {
      type,
      count,
      unitPrice,
      isPriced: unitPrice != null,
      lineCost: unitPrice != null ? Math.round(count * unitPrice * 100) / 100 : null,
      rateDescription: rate?.description || null,
    };
  });

  const sorBandTotal = bandBreakdown.reduce((s, b) => s + (b.lineCost || 0), 0);
  const sampleTotal = samplePricing.reduce((s, p) => s + (p.lineCost || 0), 0);
  const hasPoaBands = bandBreakdown.some((b) => !b.isPriced);
  const hasPoaSamples = samplePricing.some((p) => !p.isPriced && p.count > 0);

  // The chargeable total: meterage revenue is the contract basis; SOR band + sample
  // costs are additive line items where priced. Where meterage_rate is unset, fall
  // back to the priced SOR band total so the report still shows a figure.
  const total = meterageRate > 0
    ? meterageRevenue + sampleTotal
    : sorBandTotal + sampleTotal;

  return {
    meterageRate,
    meterageRevenue: Math.round(meterageRevenue * 100) / 100,
    bandBreakdown,
    samplePricing,
    sorBandTotal: Math.round(sorBandTotal * 100) / 100,
    sampleTotal: Math.round(sampleTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
    hasPoaBands,
    hasPoaSamples,
    usingMeterageRate: meterageRate > 0,
  };
}