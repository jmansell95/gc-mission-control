import { parseComplianceDate as parseDate } from './complianceDate';

/**
 * Compliance score calculation for a staff member.
 * Aggregates certs/cards, training records, and Mitti safety checks into
 * a single weighted score (0-100) with a traffic-light band.
 *
 * @param {object} opts
 * @param {array}  opts.complianceItems — ComplianceItem records (category: 'staff')
 * @param {array}  opts.trainingCategories — TrainingRequirement records assigned to this person
 * @param {array}  opts.trainingBookings — TrainingBooking records for this person
 * @param {array}  opts.mittiAudits — SafetyReport audits attributed to this person
 * @returns {{ score: number, band: 'green'|'amber'|'red', summary: string, certs: object, training: object, mitti: object }}
 */
export function calculateStaffComplianceScore({ complianceItems = [], trainingCategories = [], trainingBookings = [], mittiAudits = [] }) {
  const now = new Date();
  const THIRTY_DAYS = 30 * 86400000;

  // --- Certs & Cards ---
  let certsValid = 0, certsExpiring = 0, certsExpired = 0, certsPending = 0;
  const certDetails = complianceItems.map(ci => {
    if (ci.status_override === 'not_required') return { ...ci, status: 'not_required' };
    if (ci.status_override === 'missing') return { ...ci, status: 'missing' };
    if (ci.review_status === 'pending_review') { certsPending++; return { ...ci, status: 'pending' }; }
    if (!ci.expiry_date) return { ...ci, status: 'unknown' };
    const d = parseDate(ci.expiry_date);
    if (!d) return { ...ci, status: 'unknown' };
    const ms = d.getTime() - now.getTime();
    if (ms < 0) { certsExpired++; return { ...ci, status: 'expired' }; }
    if (ms <= THIRTY_DAYS) { certsExpiring++; return { ...ci, status: 'expiring' }; }
    certsValid++; return { ...ci, status: 'valid' };
  });

  // --- Training ---
  // A training category is "met" if there's a passed/attended booking OR a
  // compliance item with the matching qualification_type that is valid.
  const metTypes = new Set();
  trainingBookings.forEach(tb => {
    if (tb.status === 'passed' || tb.status === 'attended') {
      metTypes.add(tb.certificate_title || tb.course_id);
    }
  });
  complianceItems.forEach(ci => {
    if (ci.qualification_type && (ci.status_override === 'auto' || !ci.status_override)) {
      const d = ci.expiry_date ? parseDate(ci.expiry_date) : null;
      if (d && d.getTime() - now.getTime() > 0) metTypes.add(ci.qualification_type);
    }
  });
  let trainingMet = 0, trainingMissing = 0;
  const trainingDetails = trainingCategories.map(tc => {
    const isMet = metTypes.has(tc.qualification_type) || metTypes.has(tc.label);
    if (isMet) { trainingMet++; return { ...tc, status: 'met' }; }
    trainingMissing++; return { ...tc, status: 'missing' };
  });

  // --- Mitti Safety Checks ---
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  let mittiRecent = 0, mittiFailed = 0, mittiOld = 0;
  const mittiDetails = mittiAudits.map(a => {
    const d = a.conducted_at ? new Date(a.conducted_at) : null;
    if (a.pass_fail === 'fail') { mittiFailed++; return { ...a, status: 'failed' }; }
    if (d && d.getTime() > weekAgo.getTime()) { mittiRecent++; return { ...a, status: 'recent' }; }
    mittiOld++; return { ...a, status: 'old' };
  });

  // --- Weighted Score ---
  let score = 100;
  score -= certsExpired * 15;
  score -= certsExpiring * 8;
  score -= certsPending * 3;
  score -= trainingMissing * 10;
  score -= mittiFailed * 10;
  score = Math.max(0, Math.min(100, score));

  const band = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';

  const parts = [];
  if (certsValid) parts.push(`${certsValid} cert${certsValid > 1 ? 's' : ''} valid`);
  if (certsExpiring) parts.push(`${certsExpiring} expiring`);
  if (certsExpired) parts.push(`${certsExpired} expired`);
  if (trainingMissing) parts.push(`${trainingMissing} training gap${trainingMissing > 1 ? 's' : ''}`);
  if (mittiRecent) parts.push(`${mittiRecent} Mitti check${mittiRecent > 1 ? 's' : ''} this week`);
  if (mittiFailed) parts.push(`${mittiFailed} failed audit${mittiFailed > 1 ? 's' : ''}`);
  const summary = parts.length > 0 ? parts.join(' · ') : 'All clear';

  return {
    score,
    band,
    summary,
    certs: { valid: certsValid, expiring: certsExpiring, expired: certsExpired, pending: certsPending, details: certDetails },
    training: { met: trainingMet, missing: trainingMissing, details: trainingDetails },
    mitti: { recent: mittiRecent, failed: mittiFailed, old: mittiOld, details: mittiDetails },
  };
}

/**
 * Find the Geotechnical division by matching name containing 'Geotechnical'
 * (case-insensitive). Returns the Division record or null.
 */
export async function findGeotechnicalDivision(base44) {
  try {
    const divisions = await base44.entities.Division.list();
    return divisions.find(d =>
      d.is_active !== false &&
      (d.name?.toLowerCase().includes('geotechnical') ||
       d.division_type === 'geotechnical')
    ) || null;
  } catch { return null; }
}