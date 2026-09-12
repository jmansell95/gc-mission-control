import { base44 } from '@/api/base44Client';

/**
 * Capture a drawn signature (PNG data URL from SignaturePad), upload it, and
 * persist a Signature record at the given tier.
 *
 * @param {object} opts
 * @param {string} opts.dataUrl       PNG data URL from the SignaturePad onChange
 * @param {string} opts.tier          'daily_worker' | 'manager_approval' | 'weekly_official'
 * @param {string} opts.signerType    'staff' | 'manager' | 'admin'
 * @param {object} opts.context       { staff_id, staff_name, manager_id, manager_name, job_id,
 *                                      assignment_id, timesheet_id, week_start, date, notes,
 *                                      payload_snapshot }
 * @returns {Promise<object>} the created Signature record
 */
export async function submitSignature({ dataUrl, tier, signerType, context = {} }) {
  if (!dataUrl) throw new Error('No signature captured');
  if (!tier) throw new Error('Signature tier is required');

  // 1. Convert the data URL to a File so we can upload it.
  const blob = await (await fetch(dataUrl)).blob();
  const fileName = `signature_${tier}_${Date.now()}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // 2. Upload the signature image.
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  if (!file_url) throw new Error('Signature upload failed');

  // 3. Persist the Signature record.
  const record = await base44.entities.Signature.create({
    tier,
    signer_type: signerType,
    staff_id: context.staff_id || '',
    staff_name: context.staff_name || '',
    manager_id: context.manager_id || '',
    manager_name: context.manager_name || '',
    job_id: context.job_id || '',
    assignment_id: context.assignment_id || '',
    timesheet_id: context.timesheet_id || '',
    week_start: context.week_start || '',
    date: context.date || '',
    signature_url: file_url,
    signed_at: new Date().toISOString(),
    payload_snapshot: context.payload_snapshot ? JSON.stringify(context.payload_snapshot) : '',
    notes: context.notes || '',
  });

  return record;
}

/**
 * Fetch all signatures for a given week / staff member, grouped by tier.
 * Used when rendering the weekly payroll PDF and the audit trail.
 */
export async function fetchSignaturesForWeek(weekStart, staffId = null) {
  const filter = { week_start: weekStart, status: 'active' };
  if (staffId) filter.staff_id = staffId;
  const list = await base44.entities.Signature.filter(filter, '-signed_at', 200);
  return list;
}

/**
 * Mark a signature as injected into a generated PDF (proves the official
 * document carries the wet-style signature).
 */
export async function markSignatureInjected(signatureId) {
  try {
    await base44.entities.Signature.update(signatureId, { pdf_injected: true });
  } catch { /* non-critical */ }
}