import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createNotification } from '../../shared/inboxEngine.ts';

// ============================================================
// checkSubconMargin — Subcontractor margin guardrail
// ============================================================
// Triggered by an entity automation on SubcontractorLog create/update.
//   1. Recalculates client_charge_net, margin_net and margin_pct from
//      purchase_cost_net × (1 + markup_percentage/100). If the stored
//      values differ, it writes the corrected values back (service role).
//   2. On CREATE events only, if the margin is zero or negative (or the
//      markup is zero), it records a warning in FinancialAuditLog so
//      finance can review before the cost is invoiced.
//
// Loop safety: the recalculation update re-triggers this automation, but
// the second pass finds no differences and exits without writing. Audit
// warnings are only emitted on create events (one-shot), so no log loop.

const LOW_MARGIN_THRESHOLD_PCT = 5; // flag below 5% margin

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const event = body.event || {};
    const data = body.data || null;

    const entityId = event.entity_id || body.entity_id;
    const action = event.type || body.action;
    if (!entityId || action !== 'create' && action !== 'update') {
      return Response.json({ ok: true, skipped: true, reason: 'not a create/update event' });
    }

    // Fetch the current record (data may be null if payload_too_large)
    let log = data;
    if (!log) {
      try {
        log = await base44.asServiceRole.entities.SubcontractorLog.get(entityId);
      } catch (_) {
        return Response.json({ ok: false, error: 'Could not fetch subcontractor log' }, { status: 500 });
      }
    }
    if (!log) {
      return Response.json({ ok: true, skipped: true, reason: 'record not found' });
    }

    // ── Recalculate margin fields ──
    const purchaseNet = Number(log.purchase_cost_net) || 0;
    const markupPct = Number(log.markup_percentage) || 0;
    const vatRate = Number(log.purchase_cost_vat) > 0
      ? (Number(log.purchase_cost_vat) / Math.max(purchaseNet, 0.01)) * 100
      : 20;

    let clientChargeNet: number;
    if (log.sell_rate_basis && log.sell_rate_basis !== 'markup_on_cost' && Number(log.sell_rate) > 0) {
      // Rate-based billing: sell_rate applied per its basis (simplified — day/per_metre/per_unit × qty)
      const sellRate = Number(log.sell_rate) || 0;
      const qty = log.sell_rate_basis === 'day_rate'
        ? (Number(log.hours_worked) || 0) / 8
        : log.sell_rate_basis === 'per_metre'
          ? (Number(log.metres_drilled) || 0)
          : log.sell_rate_basis === 'per_unit'
            ? (Number(log.units_completed) || 1)
            : 1;
      clientChargeNet = round2(sellRate * qty);
    } else {
      // Default: markup on cost
      clientChargeNet = round2(purchaseNet * (1 + markupPct / 100));
    }
    const clientChargeVat = round2(clientChargeNet * (vatRate / 100));
    const clientChargeGross = round2(clientChargeNet + clientChargeVat);
    const purchaseVat = round2(purchaseNet * (vatRate / 100));
    const purchaseGross = round2(purchaseNet + purchaseVat);
    const marginNet = round2(clientChargeNet - purchaseNet);
    const marginPct = clientChargeNet > 0 ? round2((marginNet / clientChargeNet) * 100) : 0;

    // Write back only if values differ (prevents infinite automation loop)
    const needsUpdate =
      Number(log.client_charge_net) !== clientChargeNet ||
      Number(log.client_charge_vat) !== clientChargeVat ||
      Number(log.client_charge_gross) !== clientChargeGross ||
      Number(log.purchase_cost_gross) !== purchaseGross ||
      Number(log.margin_net) !== marginNet ||
      Number(log.margin_pct) !== marginPct;

    if (needsUpdate) {
      try {
        await base44.asServiceRole.entities.SubcontractorLog.update(entityId, {
          client_charge_net: clientChargeNet,
          client_charge_vat: clientChargeVat,
          client_charge_gross: clientChargeGross,
          purchase_cost_gross: purchaseGross,
          margin_net: marginNet,
          margin_pct: marginPct,
        });
      } catch (e) {
        // Non-fatal — the log still exists; just can't auto-correct
      }
    }

    // ── Margin guardrail audit warning (create events only) ──
    if (action === 'create') {
      const isAtRisk = marginNet <= 0 || marginPct < LOW_MARGIN_THRESHOLD_PCT || markupPct === 0;
      if (isAtRisk) {
        const subName = log.subcontractor_name || 'Unknown subcontractor';
        const reason = markupPct === 0
          ? `Zero markup — billed to client at cost (zero margin). Purchase cost: £${purchaseNet.toFixed(2)}`
          : marginNet <= 0
            ? `Negative/zero margin: £${marginNet.toFixed(2)} (${marginPct.toFixed(1)}%). Purchase £${purchaseNet.toFixed(2)} → Client £${clientChargeNet.toFixed(2)}`
            : `Low margin: ${marginPct.toFixed(1)}% (£${marginNet.toFixed(2)}). Below ${LOW_MARGIN_THRESHOLD_PCT}% threshold.`;

        try {
          await base44.asServiceRole.entities.FinancialAuditLog.create({
            entity_name: 'SubcontractorLog',
            entity_id: entityId,
            action: 'create',
            changed_fields: ['margin_net', 'margin_pct', 'markup_percentage'],
            field_changes: JSON.stringify({
              margin_net: { before: null, after: marginNet },
              margin_pct: { before: null, after: marginPct },
              markup_percentage: { before: null, after: markupPct },
            }),
            record_summary: `⚠️ MARGIN WARNING — ${subName}: ${reason}`,
            actor_user_id: log.created_by_id || null,
            actor_name: log.created_by_id || 'system',
            source: 'entity_automation',
          });
        } catch (_) { /* audit logging is best-effort */ }

        // ── Inbox alert to billing managers ──
        try {
          const users = await base44.asServiceRole.entities.User.list();
          const adminRecipients = users.filter(u => u.role === 'admin' && u.email).map(u => ({
            staffId: null, userId: u.id, name: u.full_name || u.email, email: u.email,
          }));
          await createNotification(base44, {
            recipients: adminRecipients,
            type: 'alert',
            category: 'margin_breach',
            title: `Margin warning — ${subName} (${marginPct.toFixed(1)}%)`,
            body: `${reason}. Subcontractor log for ${subName}. Please review the pricing before this cost is invoiced.`,
            sourceHub: 'billing',
            sourceEntity: 'SubcontractorLog',
            sourceId: entityId,
            deepLink: '/billing?tab=margin',
            priority: 'urgent',
          });
        } catch (_) {}
      }
    }

    return Response.json({
      ok: true,
      entity_id: entityId,
      recalculated: needsUpdate,
      margin_net: marginNet,
      margin_pct: marginPct,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}