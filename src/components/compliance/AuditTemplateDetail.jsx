import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Search, CheckCircle2, XCircle, AlertTriangle, FileText, Calendar, User, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import HubCard from '@/components/hubs/HubCard';
import AuditExportBar from './AuditExportBar';
import { getCategoryMeta, getStatusMeta, fmtDateTime } from './auditConstants';

const PASS_FAIL_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'pass', label: 'Passed' },
  { key: 'fail', label: 'Failed' },
  { key: 'pending', label: 'Pending' },
];

// Stats tile for the template hero
function StatTile({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'from-slate-50 to-slate-100 text-slate-700',
    emerald: 'from-emerald-50 to-emerald-100 text-emerald-700',
    rose: 'from-rose-50 to-rose-100 text-rose-700',
    amber: 'from-amber-50 to-amber-100 text-amber-700',
    brand: 'from-[#2E5A1A]/8 to-[#8DC63F]/12 text-[#2E5A1A]',
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-3 flex items-center gap-2.5`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide opacity-60 leading-none">{label}</p>
        <p className="text-lg font-extrabold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function AuditTemplateDetail({ template, onBack, onSelectAudit }) {
  const [query, setQuery] = useState('');
  const [passFailFilter, setPassFailFilter] = useState('all');
  const [auditorFilter, setAuditorFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-template', template.template_id],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
  });
  const { data: config } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => { const l = await base44.entities.MittiConfig.filter({ key: 'global' }); return l?.[0] || null; },
  });

  // Filter to just this template's audits, only from known staff.
  // Falls back to name→ID matching for old reports without template_id.
  const templateReports = useMemo(() => {
    const nameToTemplateId = {};
    for (const t of (config?.synced_templates || [])) {
      if (t.name) nameToTemplateId[t.name.toLowerCase()] = t.template_id;
    }
    return reports.filter(r => {
      if (!r.auditor_staff_id) return false;
      let tid = r.template_id;
      if (!tid && r.audit_template_name) {
        tid = nameToTemplateId[r.audit_template_name.toLowerCase()] || r.audit_template_name;
      }
      tid = tid || 'unknown';
      return tid === template.template_id;
    });
  }, [reports, template.template_id, config]);

  // Build auditor list for the filter dropdown
  const auditors = useMemo(() => {
    const set = new Map();
    for (const r of templateReports) {
      if (r.auditor_name) set.set(r.auditor_name, r.auditor_email || '');
    }
    return Array.from(set.entries()).map(([name, email]) => ({ name, email }));
  }, [templateReports]);

  // Per-template trend chart data (weekly pass rate)
  const trendData = useMemo(() => {
    const scored = templateReports.filter(r => r.pass_fail === 'pass' || r.pass_fail === 'fail');
    const byWeek = {};
    scored.forEach(r => {
      const d = r.conducted_at || r.created_date;
      if (!d) return;
      const dt = new Date(d);
      const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - dt.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { week: key, total: 0, passed: 0 };
      byWeek[key].total++;
      if (r.pass_fail === 'pass') byWeek[key].passed++;
    });
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)).slice(-12).map(w => ({
      week: new Date(w.week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      passRate: w.total > 0 ? Math.round((w.passed / w.total) * 100) : null,
      count: w.total,
    }));
  }, [templateReports]);

  // Template stats
  const stats = useMemo(() => {
    const passed = templateReports.filter(r => r.pass_fail === 'pass').length;
    const failed = templateReports.filter(r => r.pass_fail === 'fail').length;
    const scored = passed + failed;
    const actionCount = templateReports.reduce((s, r) => s + (r.action_items || []).length, 0);
    const lastDate = templateReports[0] ? (templateReports[0].conducted_at || templateReports[0].created_date) : null;
    return {
      total: templateReports.length,
      passed,
      failed,
      passRate: scored > 0 ? Math.round((passed / scored) * 100) : null,
      actionCount,
      lastDate,
    };
  }, [templateReports]);

  const filtered = useMemo(() => {
    let list = templateReports;
    if (passFailFilter !== 'all') list = list.filter(r => r.pass_fail === passFailFilter);
    if (auditorFilter !== 'all') list = list.filter(r => r.auditor_name === auditorFilter);
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff = null;
      if (dateFilter === '7d') cutoff = new Date(now.getTime() - 7 * 86400000);
      else if (dateFilter === '30d') cutoff = new Date(now.getTime() - 30 * 86400000);
      else if (dateFilter === '90d') cutoff = new Date(now.getTime() - 90 * 86400000);
      if (cutoff) list = list.filter(r => { const d = r.conducted_at || r.created_date; return d && new Date(d) >= cutoff; });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r =>
        (r.audit_title || '').toLowerCase().includes(q) ||
        (r.auditor_name || '').toLowerCase().includes(q) ||
        (r.job_name || '').toLowerCase().includes(q) ||
        (r.site_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [templateReports, passFailFilter, auditorFilter, dateFilter, query]);

  const meta = getCategoryMeta(template.category);
  const Icon = meta.icon;

  return (
    <div className="space-y-3">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> All Templates
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-700 truncate">{template.name}</span>
      </div>

      {/* Template hero — stats tiles */}
      <div className="hub-glass rounded-3xl p-4 sm:p-5 animate-slide-up">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl ${meta.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${meta.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{template.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badgeClass}`}>{meta.label}</span>
              <span className="text-xs text-slate-400">{template.template_id}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <StatTile icon={FileText} label="Total Audits" value={stats.total} tone="brand" />
          <StatTile icon={CheckCircle2} label="Pass Rate" value={stats.passRate != null ? `${stats.passRate}%` : '—'} tone={stats.passRate != null ? (stats.passRate >= 80 ? 'emerald' : stats.passRate >= 50 ? 'amber' : 'rose') : 'slate'} />
          <StatTile icon={XCircle} label="Failed" value={stats.failed} tone={stats.failed > 0 ? 'rose' : 'slate'} />
          <StatTile icon={AlertTriangle} label="Actions" value={stats.actionCount} tone={stats.actionCount > 0 ? 'amber' : 'slate'} />
          <StatTile icon={Calendar} label="Last Audit" value={stats.lastDate ? new Date(stats.lastDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'} tone="slate" />
        </div>
      </div>

      {/* Per-template trend chart */}
      {trendData.length > 0 && (
        <HubCard icon={TrendingUp} title="Pass Rate Trend" subtitle="Weekly pass rate for this template" tone="brand">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(value) => value == null ? ['—', 'Pass Rate'] : [`${value}%`, 'Pass Rate']}
              />
              <Line type="monotone" dataKey="passRate" stroke="#2E5A1A" strokeWidth={3} dot={{ fill: '#8DC63F', r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </HubCard>
      )}

      {/* Audit list with filters */}
      <HubCard icon={BarChart3} title="Audits" subtitle={`${filtered.length} of ${templateReports.length} audits`} tone="brand"
        action={
          <div className="flex items-center gap-2">
            <AuditExportBar audits={filtered} fileName={`audits-${template.name?.replace(/\s+/g, '-').toLowerCase() || 'template'}`} />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A] w-40 sm:w-52" />
            </div>
          </div>
        }>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex gap-1.5">
            {PASS_FAIL_CHIPS.map(c => (
              <button key={c.key} onClick={() => setPassFailFilter(c.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${passFailFilter === c.key ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c.label}</button>
            ))}
          </div>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A]">
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select value={auditorFilter} onChange={e => setAuditorFilter(e.target.value)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A] max-w-[180px]">
            <option value="all">All auditors</option>
            {auditors.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </div>

        {/* Audit list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No audits match these filters</p>
            <p className="text-xs text-slate-400">Try adjusting the filters or search.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {filtered.map(r => {
              const failed = r.pass_fail === 'fail';
              const passed = r.pass_fail === 'pass';
              const statusMeta = getStatusMeta(r.pass_fail);
              const StatusIcon = statusMeta.icon;
              const actionCount = (r.action_items || []).length;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectAudit(r)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition hover:bg-slate-50/80 border ${failed ? 'border-l-4 border-l-rose-400 bg-rose-50/30 border-t-slate-100 border-r-slate-100 border-b-slate-100' : passed ? 'border-l-4 border-l-emerald-400 border-t-slate-100 border-r-slate-100 border-b-slate-100' : 'border border-slate-100'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${failed ? 'bg-rose-100' : passed ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <StatusIcon className={`w-4 h-4 ${failed ? 'text-rose-600' : passed ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1 truncate"><User className="w-3 h-3" />{r.auditor_name || '—'}</span>
                      <span className="flex items-center gap-1 truncate"><Calendar className="w-3 h-3" />{fmtDateTime(r.conducted_at)}</span>
                      {r.job_name && <span className="truncate">· {r.job_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.score_percentage != null && <span className="text-xs font-bold tabular-nums text-slate-600">{Math.round(r.score_percentage)}%</span>}
                    {actionCount > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{actionCount}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </HubCard>
    </div>
  );
}