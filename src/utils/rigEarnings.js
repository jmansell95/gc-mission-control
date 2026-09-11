// Live rig earnings engine — shared by the job-detail Rig Earnings strip
// and the dashboard Rig Earnings widget.
//
// All figures are computed from the live InvestigationLog records (the same
// records the KeyLogBook AGS webhook writes) and the current rate cards, so
// every surface stays in sync with the actual drilling data.
//
// Earnings = metres × job.meterage_rate (the per-metre contract rate)
//          + sum(charge_amount on auto-priced keylogbook_remarks activities)
//          + SOR depth-band metres × SOR price (where priced)

import { allocateDepthBands, getSorDepthBands } from '@/utils/geotechBilling';

// Group investigation logs by rig. device_name (from AGS HDPH_EXC / SHFT_EXC)
// is the primary rig key. When it's empty (the AGS file has no rig field),
// fall back to the driller (staff_name) so work is still organised into
// clickable groups rather than dumped under "Unassigned".
export function groupLogsByRig(logs) {
  const rigs = {};
  (logs || []).forEach((l) => {
    const device = (l.device_name || '').trim();
    const driller = (l.staff_name || '').trim();
    const key = device || driller || 'Unassigned';
    if (!rigs[key]) {
      rigs[key] = { key, name: key, isDrillerFallback: !device && !!driller, logs: [] };
    }
    rigs[key].logs.push(l);
  });
  return Object.values(rigs);
}

// Compute per-rig metres + earnings from live logs + rate cards.
// Returns { perRig: [...], totals }.
export function computeRigEarnings({ logs, sorItems = [], job = null }) {
  const sorDepthBands = getSorDepthBands(sorItems);
  const meterageRate = Number(job?.meterage_rate) || 0;
  const rigs = groupLogsByRig(logs);

  const perRig = rigs.map((rig) => {
    const boreholes = new Set();
    const depthsByRef = {};
    rig.logs.forEach((l) => {
      if (l.borehole_ref) boreholes.add(l.borehole_ref);
      // Metres: max depth_to per borehole_ref on ags_import technical logs
      if (l.source === 'ags_import' && l.borehole_ref && l.depth_to != null) {
        if (depthsByRef[l.borehole_ref] == null || l.depth_to > depthsByRef[l.borehole_ref]) {
          depthsByRef[l.borehole_ref] = l.depth_to;
        }
      }
    });
    let totalMetres = 0;
    Object.values(depthsByRef).forEach((d) => { totalMetres += d; });

    // Earnings
    let earnings = 0;
    let hasRate = false;
    const breakdown = { meterage: 0, charges: 0, sorBands: 0 };

    if (meterageRate > 0 && totalMetres > 0) {
      breakdown.meterage = Math.round(totalMetres * meterageRate * 100) / 100;
      earnings += breakdown.meterage;
      hasRate = true;
    }
    // Sum auto-priced remark charges (already stamped at ingest)
    rig.logs.forEach((l) => {
      if (l.source === 'keylogbook_remarks' && l.chargeable && l.charge_amount != null) {
        breakdown.charges += Number(l.charge_amount) || 0;
        hasRate = true;
      }
    });
    earnings += breakdown.charges;
    // SOR depth bands where priced
    if (sorDepthBands.length > 0) {
      Object.values(depthsByRef).forEach((depth) => {
        allocateDepthBands(depth).forEach((band) => {
          const sor = sorDepthBands.find((s) => s.from === band.from && s.to === band.to);
          if (sor?.price != null) {
            breakdown.sorBands += band.metres * sor.price;
            hasRate = true;
          }
        });
      });
      breakdown.sorBands = Math.round(breakdown.sorBands * 100) / 100;
      earnings += breakdown.sorBands;
    }

    return {
      key: rig.key,
      name: rig.name,
      isDrillerFallback: rig.isDrillerFallback,
      logs: rig.logs,
      boreholes,
      boreholeCount: boreholes.size,
      totalMetres: Math.round(totalMetres * 100) / 100,
      earnings: Math.round(earnings * 100) / 100,
      hasRate,
      breakdown,
    };
  });

  perRig.sort((a, b) => b.earnings - a.earnings || b.totalMetres - a.totalMetres);

  const totals = perRig.reduce(
    (acc, r) => ({
      metres: acc.metres + r.totalMetres,
      earnings: acc.earnings + r.earnings,
      boreholes: acc.boreholes + r.boreholeCount,
      rigs: acc.rigs + 1,
    }),
    { metres: 0, earnings: 0, boreholes: 0, rigs: 0 }
  );

  return { perRig, totals };
}

// Per-borehole metres + earnings for a single rig's logs.
export function computeBoreholeEarnings(logs, job, sorDepthBands) {
  const byRef = {};
  (logs || []).forEach((l) => {
    if (!l.borehole_ref) return;
    if (!byRef[l.borehole_ref]) {
      byRef[l.borehole_ref] = { ref: l.borehole_ref, logs: [], maxDepth: 0, charges: 0, dates: new Set(), loggers: new Set() };
    }
    byRef[l.borehole_ref].logs.push(l);
    if (l.source === 'ags_import' && l.depth_to != null && l.depth_to > byRef[l.borehole_ref].maxDepth) {
      byRef[l.borehole_ref].maxDepth = l.depth_to;
    }
    if (l.source === 'keylogbook_remarks' && l.chargeable && l.charge_amount != null) {
      byRef[l.borehole_ref].charges += Number(l.charge_amount) || 0;
    }
    if (l.date) byRef[l.borehole_ref].dates.add(l.date);
    if (l.staff_name) byRef[l.borehole_ref].loggers.add(l.staff_name);
  });

  const meterageRate = Number(job?.meterage_rate) || 0;
  return Object.values(byRef).map((b) => {
    const breakdown = { meterage: 0, charges: 0, sorBands: 0 };
    let earnings = 0;
    let hasRate = false;
    if (meterageRate > 0 && b.maxDepth > 0) {
      breakdown.meterage = Math.round(b.maxDepth * meterageRate * 100) / 100;
      earnings += breakdown.meterage;
      hasRate = true;
    }
    breakdown.charges = Math.round(b.charges * 100) / 100;
    earnings += breakdown.charges;
    if (b.charges > 0) hasRate = true;
    if (sorDepthBands && sorDepthBands.length > 0 && b.maxDepth > 0) {
      allocateDepthBands(b.maxDepth).forEach((band) => {
        const sor = sorDepthBands.find((s) => s.from === band.from && s.to === band.to);
        if (sor?.price != null) { breakdown.sorBands += band.metres * sor.price; hasRate = true; }
      });
      breakdown.sorBands = Math.round(breakdown.sorBands * 100) / 100;
      earnings += breakdown.sorBands;
    }
    const sortedDates = [...b.dates].sort();
    return {
      ref: b.ref,
      maxDepth: Math.round(b.maxDepth * 100) / 100,
      earnings: Math.round(earnings * 100) / 100,
      hasRate,
      breakdown,
      logCount: b.logs.length,
      firstDate: sortedDates[0] || null,
      lastDate: sortedDates[sortedDates.length - 1] || null,
      loggers: [...b.loggers],
      logs: b.logs,
    };
  }).sort((a, b) => a.ref.localeCompare(b.ref));
}

// Resolve a KeyLogBook logger name to a Staff record (case-insensitive full match).
export function resolveLoggerStaff(name, staffList = []) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  return staffList.find((s) => (s.name || '').toLowerCase().trim() === n) || null;
}

// Collect all distinct logger names from a set of logs (staff_name + crew_names).
export function collectLoggers(logs) {
  const set = new Set();
  (logs || []).forEach((l) => {
    if (l.staff_name && !l.staff_name.startsWith('AGS Import') && l.staff_name !== 'KeyLogBook Webhook') {
      set.add(l.staff_name);
    }
    if (Array.isArray(l.crew_names)) {
      l.crew_names.forEach((n) => { if (n && !n.startsWith('AGS Import')) set.add(n); });
    }
  });
  return [...set];
}