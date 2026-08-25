import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// sendScheduledReports — runs on a schedule, finds all
// ReportTemplates with an active schedule_cadence, fetches the
// data for each, builds an HTML email summary, and sends it to
// the stored recipients via SendEmail. Uses the service role so
// it works without a user session.
// ============================================================

function tally(rows, field) {
  const m = {};
  for (const r of rows) {
    const k = r[field] || 'Unassigned';
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}

function sumField(rows, field) {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

function buildHtmlTable(title, rows, maxRows = 15) {
  if (!rows.length) return `<p style="color:#64748b;font-size:12px;">No data for ${title}.</p>`;
  const keys = Object.keys(rows[0]).slice(0, 6);
  const header = keys.map(k => `<th style="background:#2E5A1A;color:#fff;padding:6px 8px;text-align:left;font-size:11px;">${k.replace(/_/g, ' ')}</th>`).join('');
  const bodyRows = rows.slice(0, maxRows).map(r =>
    `<tr>${keys.map(k => {
      const v = r[k];
      let display = '';
      if (v == null) display = '';
      else if (Array.isArray(v)) display = v.join('; ');
      else if (typeof v === 'object') display = JSON.stringify(v).substring(0, 40);
      else display = String(v).substring(0, 60);
      return `<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${display}</td>`;
    }).join('')}</tr>`
  ).join('');
  const more = rows.length > maxRows ? `<tr><td colspan="${keys.length}" style="padding:6px 8px;font-size:10px;color:#94a3b8;">…and ${rows.length - maxRows} more rows</td></tr>` : '';
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;"><thead><tr>${header}</tr></thead><tbody>${bodyRows}${more}</tbody></table>`;
}

function buildChartSummary(title, data) {
  if (!data.length) return '';
  const bars = data.map(d => {
    const pct = Math.min(100, (d.value / Math.max(...data.map(x => x.value))) * 100);
    return `<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>${d.name}</span><strong>${d.value}</strong></div><div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:#2E5A1A;border-radius:3px;"></div></div></div>`;
  }).join('');
  return `<div style="margin-top:12px;"><p style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px;">${title}</p>${bars}</div>`;
}

async function fetchTemplateData(base44, tpl) {
  const divQuery = tpl.filters?.divisionId ? { division_id: tpl.filters.divisionId } : {};
  const entity = tpl.source_entity || 'Job';
  let rows = [];
  try {
    rows = await base44.asServiceRole.entities[entity].filter(divQuery, '-created_date', 200);
  } catch (e) {
    // entity might not exist or be inaccessible
    rows = [];
  }
  return rows;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Optional auth check — this runs on a schedule via service role,
    // but if called manually we verify the caller is an admin.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'director') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    } catch (e) { /* scheduled call — no user session, proceed with service role */ }

    const templates = await base44.asServiceRole.entities.ReportTemplate.filter({ schedule_cadence: { $ne: 'none' } });
    const now = new Date();
    const sent = [];
    const errors = [];

    for (const tpl of templates) {
      if (!tpl.schedule_recipients) { errors.push({ name: tpl.name, error: 'No recipients' }); continue; }

      // Check if due based on cadence + last_run_at
      if (tpl.last_run_at) {
        const last = new Date(tpl.last_run_at);
        const daysSince = (now - last) / (1000 * 60 * 60 * 24);
        if (tpl.schedule_cadence === 'weekly' && daysSince < 6) continue;
        if (tpl.schedule_cadence === 'monthly' && daysSince < 27) continue;
        if (tpl.schedule_cadence === 'quarterly' && daysSince < 85) continue;
      }

      try {
        const rows = await fetchTemplateData(base44, tpl);
        const groupBy = tpl.group_by || 'status';
        const tallied = tally(rows, groupBy);
        const total = rows.length;
        const sumKey = tpl.fields?.[0] || 'budget_amount';
        const totalValue = sumField(rows, sumKey);

        const html = `
          <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#2E5A1A,#1c4a12);padding:20px 24px;">
              <h1 style="color:#fff;font-size:20px;margin:0;">${tpl.name}</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:4px 0 0;">Scheduled report · ${tpl.schedule_cadence} · ${now.toDateString()}</p>
            </div>
            <div style="padding:20px 24px;">
              ${tpl.description ? `<p style="font-size:13px;color:#475569;margin:0 0 12px;">${tpl.description}</p>` : ''}
              ${tpl.schedule_message ? `<div style="background:#f1f5f9;border-radius:8px;padding:10px 12px;margin-bottom:12px;"><p style="font-size:12px;color:#475569;margin:0;">${tpl.schedule_message}</p></div>` : ''}
              <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;background:#fff;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin:0;">Total Records</p>
                  <p style="font-size:24px;font-weight:800;color:#2E5A1A;margin:4px 0 0;">${total}</p>
                </div>
                <div style="flex:1;background:#fff;border-radius:8px;padding:12px;border:1px solid #e2e8f0;">
                  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin:0;">${sumKey.replace(/_/g, ' ')} Total</p>
                  <p style="font-size:24px;font-weight:800;color:#2E5A1A;margin:4px 0 0;">${totalValue.toLocaleString()}</p>
                </div>
              </div>
              ${buildChartSummary(`Breakdown by ${groupBy.replace(/_/g, ' ')}`, tallied)}
              ${buildHtmlTable('Recent Records', rows, 10)}
              <p style="font-size:11px;color:#94a3b8;margin-top:16px;">Generated by GC Mission Control Reports Hub</p>
            </div>
          </div>
        `;

        const recipients = tpl.schedule_recipients.split(',').map(s => s.trim()).filter(Boolean).join(',');
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipients,
          subject: `${tpl.name} — ${tpl.schedule_cadence} report (${now.toLocaleDateString()})`,
          body: html,
        });

        await base44.asServiceRole.entities.ReportTemplate.update(tpl.id, { last_run_at: now.toISOString() });
        sent.push(tpl.name);
      } catch (e) {
        errors.push({ name: tpl.name, error: e.message });
      }
    }

    return Response.json({ status: 'success', sent: sent.length, sentNames: sent, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}