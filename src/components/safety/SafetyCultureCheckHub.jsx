import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldAlert, ShieldCheck, Car, Wrench, ClipboardCheck, FileText, Loader2,
  ExternalLink, AlertTriangle, Users, Calendar, ChevronRight, Search, Zap,
} from 'lucide-react';
const ACCENT = '#2E5A1A';

// Classify a Mitti audit template into one of the standard daily checks.
function classifyTemplate(name = '') {
  const n = name.toLowerCase();
  if (/vehicle|car|van|daily check/.test(n)) return { key: 'vehicle', label: 'Vehicle Check', icon: Car, color: 'amber' };
  if (/plant|equipment/.test(n)) return { key: 'plant', label: 'Plant & Equipment', icon: Wrench, color: 'blue' };
  if (/powra|risk/.test(n)) return { key: 'powra', label: 'POWRA', icon: ClipboardCheck, color: 'emerald' };
  return { key: 'other', label: 'Other', icon: FileText, color: 'slate' };
}

const toneCls = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function MittiCheckHub({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | overdue | vehicle | plant | powra

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports', 'check-hub'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 200),
  });

  const now = new Date();

  // Flatten overdue action items across open reports.
  const overdueActions = useMemo(() => reports
    .filter((r) => r.status === 'open')
    .flatMap((r) => (r.action_items || [])
      .filter((a) => a && a.due_date && new Date(a.due_date) < now)
      .map((a) => ({ ...a, audit: r }))),
    [reports]);

  // Group reports by who completed them (auditor_name).
  const byAuditor = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const name = r.auditor_name || r.auditor_email || 'Unknown';
      if (!map[name]) map[name] = { name, email: r.auditor_email || '', counts: { vehicle: 0, plant: 0, powra: 0, other: 0 }, lastDate: null, total: 0, overdue: 0 };
      const cls = classifyTemplate(r.audit_template_name).key;
      map[name].counts[cls]++;
      map[name].total++;
      const dt = r.conducted_at || r.created_date;
      if (dt && (!map[name].lastDate || new Date(dt) > new Date(map[name].lastDate))) map[name].lastDate = dt;
      map[name].overdue += (r.action_items || []).filter((a) => a && a.due_date && new Date(a.due_date) < now).length;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [reports]);

  const auditsThisWeek = useMemo(() => {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return reports.filter((r) => r.conducted_at && new Date(r.conducted_at) >= weekAgo).length;
  }, [reports]);

  // Filtered recent audits table.
  const filteredReports = useMemo(() => {
    let list = reports;
    if (filter === 'overdue') list = list.filter((r) => (r.action_items || []).some((a) => a && a.due_date && new Date(a.due_date) < now));
    else if (filter !== 'all') list = list.filter((r) => classifyTemplate(r.audit_template_name).key === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) =>
        (r.audit_title || '').toLowerCase().includes(q) ||
        (r.audit_template_name || '').toLowerCase().includes(q) ||
        (r.auditor_name || '').toLowerCase().includes(q) ||
        (r.job_name || '').toLowerCase().includes(q) ||
        (r.site_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [reports, filter, query]);

  const openCount = reports.filter((r) => r.status === 'open').length;
  const stats = [
    { icon: AlertTriangle, label: 'Overdue Actions', value: overdueActions.length, sub: 'Past their due date', gradient: overdueActions.length > 0 ? 'stat-gradient-rose' : 'stat-gradient-emerald', glow: overdueActions.length > 0 ? 'glow-rose' : 'glow-emerald' },
    { icon: ClipboardCheck, label: 'Audits This Week', value: auditsThisWeek, sub: 'Completed in last 7 days', gradient: 'stat-gradient-blue', glow: 'glow-blue' },
    { icon: Users, label: 'People Completing Checks', value: byAuditor.length, sub: 'Unique auditors', gradient: 'stat-gradient-amber', glow: 'glow-amber' },
    { icon: ShieldAlert, label: 'Open Audits', value: openCount, sub: 'Awaiting close-out', gradient: 'stat-gradient-brand', glow: 'glow-brand' },
  ];

  const filterChips = [
    { key: 'all', label: 'All Audits' },
    { key: 'overdue', label: `Overdue (${overdueActions.length})` },
    { key: 'vehicle', label: 'Vehicle Checks' },
    { key: 'plant', label: 'Plant & Equipment' },
    { key: 'powra', label: 'POWRAs' },
  ];

  // No data synced — show info message instead of zero-value stats
  if (!isLoading && reports.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">No Mitti data synced</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Audit, incident and inspection data is not currently being pulled from Mitti.
          Once the integration is configured, audits, overdue actions and auditor breakdowns will appear here.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('settings')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition"
          >
            <Zap className="w-4 h-4" /> Configure Integration
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Stat tiles — vibrant gradient cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`relative rounded-2xl p-4 text-white overflow-hidden ${s.gradient} ${s.glow} shadow-lg`}>
              <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-extrabold tabular-nums leading-none">{s.value}</p>
                  <p className="text-xs font-bold text-white/90 mt-1 truncate">{s.label}</p>
                  <p className="text-[11px] text-white/70 truncate">{s.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue action items */}
      {overdueActions.length > 0 && (
        <div className="hub-glass rounded-2xl p-5 mb-5 border-l-4 border-rose-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-900">Overdue Safety Actions</h3>
            <span className="text-xs text-slate-400">{overdueActions.length} item{overdueActions.length === 1 ? '' : 's'} past due</span>
          </div>
          <div className="space-y-2">
            {overdueActions.slice(0, 12).map((a, i) => {
              const daysLate = Math.floor((now - new Date(a.due_date)) / 86400000);
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-rose-50/60 rounded-lg border border-rose-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.description || 'Untitled action'}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-slate-700">{a.audit?.auditor_name || '—'}</span>
                      <span>·</span>
                      <span>{a.audit?.audit_template_name || a.audit?.audit_title || 'Audit'}</span>
                      {a.audit?.job_name && <><span>·</span><span>{a.audit.job_name}</span></>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                      <Calendar className="w-3.5 h-3.5" /> {daysLate}d late
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Due {fmtDate(a.due_date)}</p>
                    {a.audit?.audit_report_url && (
                      <a href={a.audit.audit_report_url} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-700 hover:underline inline-flex items-center gap-0.5">
                        Report <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Who completed what */}
      <div className="hub-glass rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#2E5A1A]" />
          <h3 className="font-bold text-slate-900">Who Completed What</h3>
          <span className="text-xs text-slate-400">Grouped by auditor</span>
        </div>
        {byAuditor.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <ShieldCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            No Mitti audits received yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {byAuditor.map((a) => (
              <div key={a.name} className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {a.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{a.email || '—'}</p>
                  </div>
                  {a.overdue > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded-full">{a.overdue} overdue</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(a.counts).map(([k, v]) => {
                    const meta = { vehicle: Car, plant: Wrench, powra: ClipboardCheck, other: FileText }[k];
                    const lbl = { vehicle: 'Vehicle', plant: 'Plant', powra: 'POWRA', other: 'Other' }[k];
                    const t = { vehicle: 'amber', plant: 'blue', powra: 'emerald', other: 'slate' }[k];
                    const Icon = meta;
                    return (
                      <span key={k} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${v > 0 ? toneCls[t] : 'bg-slate-50 text-slate-300 ring-slate-200'}`}>
                        <Icon className="w-3 h-3" /> {lbl} <span className="tabular-nums">{v}</span>
                      </span>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Last check: {a.lastDate ? fmtDateTime(a.lastDate) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent audits table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-900">Recent Audits</h3>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-40 sm:w-52" />
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 px-5 pt-3 pb-1 overflow-x-auto no-scrollbar">
          {filterChips.map((c) => (
            <button key={c.key} onClick={() => setFilter(c.key)} type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${filter === c.key ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No audits match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Check</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Completed By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Job / Site</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Actions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.slice(0, 60).map((r) => {
                  const cls = classifyTemplate(r.audit_template_name);
                  const Icon = cls.icon;
                  const overdueCount = (r.action_items || []).filter((a) => a && a.due_date && new Date(a.due_date) < now).length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ring-1 flex-shrink-0 ${toneCls[cls.color]}`}><Icon className="w-3.5 h-3.5" /></span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-xs truncate">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                            <p className="text-[10px] text-slate-400">{cls.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-medium">{r.auditor_name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.job_name || r.site_name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.conducted_at)}</td>
                      <td className="px-4 py-3">
                        {overdueCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> {overdueCount} overdue</span>
                        ) : r.action_items && r.action_items.length > 0 ? (
                          <span className="text-[10px] text-slate-500">{r.action_items.length} open</span>
                        ) : <span className="text-[10px] text-slate-300">None</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.audit_report_url ? (
                          <a href={r.audit_report_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-xs inline-flex items-center gap-0.5">PDF <ExternalLink className="w-3 h-3" /></a>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 hub-glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Synced from Mitti</p>
          <p className="text-xs text-slate-500">Audits sync automatically via webhook & scheduled pull. Configure in Settings → Integrations.</p>
        </div>
        {onNavigate && (
          <button onClick={() => onNavigate('settings')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition flex-shrink-0">
            <ChevronRight className="w-4 h-4" /> Configure
          </button>
        )}
      </div>
    </div>
  );
}