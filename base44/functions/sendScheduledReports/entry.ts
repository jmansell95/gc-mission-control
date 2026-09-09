import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { brandedWrapper, heading, p, dataTable, statTileRow, escapeHtml, getAppBaseUrl, ctaButton } from '../../shared/emailStyling.ts';

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

        const baseUrl = await getAppBaseUrl(base44);
        const tableRows = rows.slice(0, 10).map(r => {
          const keys = Object.keys(r).slice(0, 6);
          return keys.map(k => {
            const v = r[k];
            if (v == null) return '';
            if (Array.isArray(v)) return v.join('; ');
            if (typeof v === 'object') return JSON.stringify(v).substring(0, 40);
            return String(v).substring(0, 60);
          });
        });
        const tableHeaders = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6).map(k => k.replace(/_/g, ' ')) : [];
        const talliedRows = tallied.map(t => [t.name, String(t.value)]);

        const content = heading(tpl.name) +
          p(`Scheduled report · ${tpl.schedule_cadence} · ${now.toDateString()}`) +
          (tpl.description ? p(tpl.description) : '') +
          (tpl.schedule_message ? `<div style="background:#f1f5f9;border-radius:8px;padding:10px 12px;margin-bottom:12px;"><p style="font-size:12px;color:#475569;margin:0;font-family:Arial,Helvetica,sans-serif">${escapeHtml(tpl.schedule_message)}</p></div>` : '') +
          statTileRow([
            { label: 'Total Records', value: String(total), icon: '📋' },
            { label: `${sumKey.replace(/_/g, ' ')} Total`, value: totalValue.toLocaleString(), icon: '💰' },
          ]) +
          (talliedRows.length > 0 ? heading(`Breakdown by ${groupBy.replace(/_/g, ' ')}`) + dataTable(['Category', 'Count'], talliedRows) : '') +
          (tableRows.length > 0 ? heading('Recent Records') + dataTable(tableHeaders, tableRows) : '') +
          (baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/reports', 'Open Reports Hub')}</div>` : '');

        const emailHtml = brandedWrapper(content, { banner_subtitle: 'Scheduled Report', headerVariant: 'blue' });

        const recipients = tpl.schedule_recipients.split(',').map(s => s.trim()).filter(Boolean).join(',');
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipients,
          subject: `${tpl.name} — ${tpl.schedule_cadence} report (${now.toLocaleDateString()})`,
          html: emailHtml,
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