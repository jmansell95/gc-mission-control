import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, ChevronRight, AlertTriangle, TrendingUp, Clock, Settings } from 'lucide-react';
import { getCategoryMeta, fmtRelative } from './auditConstants';
import TemplateManagePanel from './TemplateManagePanel';

// Mini sparkline — shows weekly audit count as a tiny bar chart
function MiniSparkline({ data }) {
  if (!data || data.length === 0) return <div className="h-8 flex items-center text-[10px] text-slate-300">No data</div>;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.slice(-12).map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-slate-300 min-w-[2px]"
          style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

export default function AuditTemplateGrid({ onSelectTemplate }) {
  const [showManage, setShowManage] = useState(false);
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-all-templates'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
  });
  const { data: config } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => { const l = await base44.entities.MittiConfig.filter({ key: 'global' }); return l?.[0] || null; },
  });

  const templates = useMemo(() => {
    const syncedTemplates = (config?.synced_templates || []).map(t => ({
      template_id: t.template_id,
      name: t.name || t.template_id,
      synced: true,
    }));

    // Filter to only audits from known staff (auditor_staff_id is non-null)
    const staffReports = reports.filter(r => r.auditor_staff_id);

    // Group reports by template_id
    const byTemplate = {};
    for (const r of staffReports) {
      const tid = r.template_id || r.audit_template_name || 'unknown';
      if (!byTemplate[tid]) byTemplate[tid] = [];
      byTemplate[tid].push(r);
    }

    // Build the full template list: synced templates + any templates found in reports
    const allTemplateIds = new Set([
      ...syncedTemplates.map(t => t.template_id),
      ...Object.keys(byTemplate),
    ]);

    const result = [];
    for (const tid of allTemplateIds) {
      const synced = syncedTemplates.find(t => t.template_id === tid);
      const audits = byTemplate[tid] || [];
      const passed = audits.filter(r => r.pass_fail === 'pass').length;
      const failed = audits.filter(r => r.pass_fail === 'fail').length;
      const scored = passed + failed;
      const actionCount = audits.reduce((s, r) => s + (r.action_items || []).length, 0);
      const lastAudit = audits.length > 0 ? audits[0] : null;
      const lastDate = lastAudit ? (lastAudit.conducted_at || lastAudit.created_date) : null;

      // Weekly count for sparkline
      const byWeek = {};
      for (const r of audits) {
        const d = r.conducted_at || r.created_date;
        if (!d) continue;
        const dt = new Date(d);
        const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - dt.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        byWeek[key] = (byWeek[key] || 0) + 1;
      }
      const sparkline = Object.entries(byWeek).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

      // Determine category from the first audit
      const category = audits[0]?.audit_category || 'general';

      result.push({
        template_id: tid,
        name: synced?.name || audits[0]?.audit_template_name || tid,
        synced: !!synced,
        auditCount: audits.length,
        passed,
        failed,
        passRate: scored > 0 ? Math.round((passed / scored) * 100) : null,
        actionCount,
        lastDate,
        sparkline,
        category,
      });
    }

    // Sort: pinned first, then by audit count desc
    const hiddenSet = new Set((config?.hidden_templates || []));
    const pinnedSet = new Set((config?.pinned_templates || []));
    const pinnedCodes = (config?.pinned_template_codes || []).map(c => c.toUpperCase());
    result.sort((a, b) => {
      const aPinned = pinnedSet.has(a.template_id) ? 1 : 0;
      const bPinned = pinnedSet.has(b.template_id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.auditCount - a.auditCount;
    });
    // When pinned_template_codes is set, ONLY show templates whose name contains one of the codes
    if (pinnedCodes.length > 0) {
      return result.filter(t => pinnedCodes.some(code => t.name.toUpperCase().includes(code)));
    }
    // Otherwise: show if (has audits OR is pinned) AND NOT hidden
    return result.filter(t => {
      if (hiddenSet.has(t.template_id)) return false;
      if (t.auditCount > 0) return true;
      if (pinnedSet.has(t.template_id)) return true;
      return false;
    });
  }, [reports, config]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="hub-glass rounded-2xl p-4 h-40 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-2/3 mb-3"></div>
            <div className="h-3 bg-slate-100 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">No audit templates synced</p>
        <p className="text-xs text-slate-400">Connect Mitti in Settings → Integrations and sync to populate the audit dashboard.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          Showing {templates.length} template{templates.length === 1 ? '' : 's'}
          {(config?.pinned_template_codes || []).length > 0 ? ' matching your GC codes' : ' with audits'}
          {' · staff auditors only'}
        </p>
        <button
          onClick={() => setShowManage(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage Templates
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {templates.map(t => {
        const meta = getCategoryMeta(t.category);
        const Icon = meta.icon;
        return (
          <button
            key={t.template_id}
            onClick={() => onSelectTemplate(t)}
            className="hub-glass rounded-2xl p-4 text-left transition hover:shadow-lg hover:-translate-y-0.5 group animate-slide-up"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${meta.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${meta.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">{t.name}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badgeClass} mt-1`}>
                  {meta.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{t.auditCount}</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Audits</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-extrabold tabular-nums leading-none ${t.passRate != null ? (t.passRate >= 80 ? 'text-emerald-600' : t.passRate >= 50 ? 'text-amber-600' : 'text-rose-600') : 'text-slate-300'}`}>
                  {t.passRate != null ? `${t.passRate}%` : '—'}
                </p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Pass</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-extrabold tabular-nums leading-none ${t.actionCount > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{t.actionCount}</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Actions</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                {t.sparkline.length > 0 ? <MiniSparkline data={t.sparkline} /> : <div className="h-8" />}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span>{t.lastDate ? fmtRelative(t.lastDate) : 'never'}</span>
              </div>
            </div>

            {t.failed > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                <AlertTriangle className="w-3 h-3" />
                {t.failed} failed audit{t.failed === 1 ? '' : 's'}
              </div>
            )}
          </button>
        );
      })}
      </div>
      {showManage && (
        <TemplateManagePanel
          config={config}
          templates={config?.synced_templates || []}
          reports={reports}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}