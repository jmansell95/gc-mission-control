// Shared pick-list HTML generator — the single source of truth for both the
// on-screen PickListModal preview and the printed sheet. Keeping one generator
// guarantees the preview and the printed output are identical.

export function parsePickItems(delivery) {
  const raw = (delivery?.items || '')
    .split(/\n|,(?=\s)/)
    .map(x => x.trim())
    .filter(Boolean);
  return raw.length ? raw : ['(no items listed)'];
}

export function buildPickListHtml({ delivery, job, vehicle, driverName }) {
  const dateStr = delivery?.scheduled_date
    ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const items = parsePickItems(delivery);
  const itemRows = items.map((line, i) => `<tr>
        <td style="text-align:center;padding:9px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;">${i + 1}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;">${line}</td>
        <td style="text-align:center;padding:9px 8px;border-bottom:1px solid #e2e8f0;width:70px;"><span style="display:inline-block;width:18px;height:18px;border:1.5px solid #475569;border-radius:4px;"></span></td>
        <td style="text-align:center;padding:9px 8px;border-bottom:1px solid #e2e8f0;width:70px;"><span style="display:inline-block;width:18px;height:18px;border:1.5px solid #475569;border-radius:4px;"></span></td>
      </tr>`).join('');

  const metaCard = (label, value, sub) => `
      <div class="meta-card">
        <div class="label">${label}</div>
        <div class="value">${value || '—'}${sub ? `<br><span style="font-size:11px;font-weight:400;color:#64748b;">${sub}</span>` : ''}</div>
      </div>`;

  const jobRef = delivery?.job_reference || job?.job_reference || '';
  const siteContact = job?.site_contact_name ? `Site contact: ${job.site_contact_name}${job.site_contact_phone ? ' · ' + job.site_contact_phone : ''}` : '';
  const w3w = job?.what3words ? `what3words: ///${job.what3words}` : '';
  const vehicleHeight = vehicle?.height_m ? `${vehicle.height_m} m — check bridge clearance` : '';

  // Embed captured digital signatures in the printed sheet when available.
  // Each signature shows as an image above the sign-off line, with the signer
  // name and timestamp — so the paper trail matches the digital trail.
  const sigImg = (dataUrl, label, name, at) => {
    if (!dataUrl) {
      return `<div class="signoff-field"><div class="signoff-label">${label}</div><div class="signoff-line"></div></div>`;
    }
    const timeStr = at ? new Date(at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
    return `<div class="signoff-field">
        <div class="signoff-label">${label}${name ? ` — ${name}` : ''}${timeStr ? ` · ${timeStr}` : ''}</div>
        <img src="${dataUrl}" style="max-height:50px;max-width:200px;border-bottom:1px solid #475569;padding-bottom:2px;" alt="signature" />
      </div>`;
  };

  const pickedSig = sigImg(delivery?.picked_signature_data_url, 'Picked by (warehouse)', delivery?.picked_by_name, delivery?.picked_at);
  const loadedSig = sigImg(delivery?.loaded_signature_data_url, 'Loaded by', delivery?.loaded_by_name, delivery?.loaded_at);
  const driverSig = sigImg(delivery?.driver_check_signature_data_url, 'Checked by (driver)', delivery?.driver_checked_by, delivery?.driver_checked_at);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pick List — ${delivery?.job_name || 'Drop'}</title>
    <style>
      @page { margin: 1.2cm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; }
      .header { background: linear-gradient(135deg, #2E5A1A, #1c4a12); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 6px; display:flex; align-items:center; justify-content:space-between; }
      .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
      .header .sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
      .header .badge { background: rgba(255,255,255,0.18); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .strip { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0 0 10px 10px; padding: 8px 16px; margin-bottom: 18px; font-size: 12px; color: #166534; font-weight: 600; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
      .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
      .meta-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
      .meta-card .value { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px; }
      .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #2E5A1A; font-weight: 800; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2E5A1A; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f1f5f9; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; font-weight: 700; text-align: left; border-bottom: 2px solid #e2e8f0; }
      th.center { text-align: center; }
      .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
      .notes-box .title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #92400e; font-weight: 700; margin-bottom: 4px; }
      .notes-box .text { font-size: 13px; color: #334155; white-space: pre-wrap; }
      .signoff-block { margin-top: 18px; border: 1.5px solid #2E5A1A; border-radius: 10px; padding: 14px 16px; background: #fafffe; }
      .signoff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 14px; }
      .signoff-row:last-child { margin-bottom: 0; }
      .signoff-field { display: flex; flex-direction: column; }
      .signoff-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #2E5A1A; font-weight: 700; margin-bottom: 22px; }
      .signoff-line { border-top: 1px solid #475569; height: 1px; }
      .signoff-row.driver-row { align-items: center; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
      .checkbox-field { flex-direction: row; align-items: center; gap: 8px; }
      .checkbox-field .signoff-label { margin-bottom: 0; }
      .check-box { display: inline-block; width: 18px; height: 18px; border: 1.5px solid #475569; border-radius: 4px; flex-shrink: 0; }
      .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
      @media print { .no-print { display: none; } }
    </style></head><body>
      <div class="header">
        <div>
          <h1>Warehouse Pick List</h1>
          <div class="sub">Ground Control — ${dateStr}</div>
        </div>
        <div class="badge">Drop ${delivery?.optimized_sequence_index || '—'}</div>
      </div>
      <div class="strip">Pick all items below, stage at the loading bay, and confirm with the driver before departure.</div>

      <div class="meta-grid">
        ${metaCard('Job', delivery?.job_name || job?.name, jobRef)}
        ${metaCard('Driver', driverName || delivery?.driver_staff_name || '—')}
        ${metaCard('Pick Up From', delivery?.pickup_address || 'Depot / Yard', 'Collect & stage here')}
        ${metaCard('Deliver To', delivery?.delivery_address || '—', delivery?.contact_name ? 'Attn: ' + delivery.contact_name : '')}
        ${metaCard('Vehicle', vehicle?.name || '—', vehicle?.registration_number || '')}
        ${metaCard('Scheduled Date', delivery?.scheduled_date ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB') : '—', delivery?.contact_phone ? 'Site tel: ' + delivery.contact_phone : '')}
      </div>

      ${delivery?.po_number ? `<div class="section-title">Reference</div><div style="font-size:14px;font-weight:700;color:#1e293b;">PO / Ref: ${delivery.po_number}</div>` : ''}

      <div class="section-title">Items to Pick</div>
      <table>
        <thead><tr>
          <th class="center" style="width:40px;">#</th>
          <th>Item Description</th>
          <th class="center" style="width:70px;">Picked</th>
          <th class="center" style="width:70px;">Loaded</th>
        </tr></thead>
        <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">No items logged</td></tr>'}</tbody>
      </table>

      ${delivery?.notes ? `<div class="notes-box"><div class="title">Driver / Special Instructions</div><div class="text">${delivery.notes}</div></div>` : ''}
      ${delivery?.condition_report ? `<div class="notes-box"><div class="title">Condition Notes</div><div class="text">${delivery.condition_report}</div></div>` : ''}

      ${(siteContact || w3w || vehicleHeight) ? `<div class="section-title">Site & Route Info</div>
        ${siteContact ? `<div style="font-size:13px;color:#334155;margin-bottom:4px;">${siteContact}</div>` : ''}
        ${w3w ? `<div style="font-size:13px;color:#334155;margin-bottom:4px;font-family:monospace;">${w3w}</div>` : ''}
        ${vehicleHeight ? `<div style="font-size:13px;color:#b45309;font-weight:600;">Vehicle height: ${vehicleHeight}</div>` : ''}
      ` : ''}

      <div class="section-title">Sign-Off</div>
      <div class="signoff-block">
        <div class="signoff-row">
          ${pickedSig}
          <div class="signoff-field">
            <div class="signoff-label">Time picked</div>
            <div class="signoff-line"></div>
          </div>
        </div>
        <div class="signoff-row">
          ${loadedSig}
          <div class="signoff-field">
            <div class="signoff-label">Time loaded</div>
            <div class="signoff-line"></div>
          </div>
        </div>
        <div class="signoff-row driver-row">
          <div class="signoff-field checkbox-field">
            <span class="check-box"></span>
            <span class="signoff-label">Driver checked load</span>
          </div>
          ${driverSig}
        </div>
      </div>
      <div class="footer">Ground Control — Warehouse Pick List · Drop ${delivery?.optimized_sequence_index || ''} · Generated ${new Date().toLocaleString('en-GB')}</div>
    </body></html>`;
}

// Open the pick list HTML in a new window and trigger the browser print dialog.
export function printPickListHtml(html) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to print the pick list.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// Download a styled PDF pick list using the shared brand styling.
import { jsPDF } from 'jspdf';
import { addBrandHeader, addSectionHeader, addTable, addKpiRow, addPageNumbers } from '@/lib/pdfStyles';

export function downloadPickListPDF({ delivery, job, vehicle, driverName }) {
  const doc = new jsPDF();
  const dateStr = delivery?.scheduled_date
    ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  addBrandHeader(doc, 'Warehouse Pick List', `Ground Control — ${dateStr}`);

  let y = addKpiRow(doc, [
    { label: 'Job', value: (delivery?.job_name || job?.name || '—').substring(0, 18) },
    { label: 'Driver', value: (driverName || delivery?.driver_staff_name || '—').substring(0, 18) },
    { label: 'Vehicle', value: (vehicle?.name || '—').substring(0, 18) },
    { label: 'Drop #', value: delivery?.optimized_sequence_index || '—' },
  ], 48);

  y = addSectionHeader(doc, 'Delivery Details', y);
  y = addTable(doc, ['Field', 'Value'], [
    ['Job Ref', delivery?.job_reference || job?.job_reference || '—'],
    ['Pick Up From', (delivery?.pickup_address || 'Depot / Yard').substring(0, 50)],
    ['Deliver To', (delivery?.delivery_address || '—').substring(0, 50)],
    ['Site Contact', (job?.site_contact_name || delivery?.contact_name || '—').substring(0, 40)],
    ['Scheduled', delivery?.scheduled_date || '—'],
    ['PO / Ref', delivery?.po_number || '—'],
  ], y);

  y += 5;
  y = addSectionHeader(doc, 'Items to Pick', y);
  const items = parsePickItems(delivery);
  y = addTable(doc, ['#', 'Item Description', 'Picked', 'Loaded'], items.map((line, i) => [
    String(i + 1), line.substring(0, 55), '☐', '☐',
  ]), y);

  if (delivery?.notes) {
    y += 5;
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 20; }
    y = addSectionHeader(doc, 'Driver / Special Instructions', y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(delivery.notes, doc.internal.pageSize.getWidth() - 28);
    lines.forEach(line => { doc.text(line, 14, y); y += 5; });
  }

  addPageNumbers(doc);
  doc.save(`pick-list-${(delivery?.job_name || 'drop').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
}