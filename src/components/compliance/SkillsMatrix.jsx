import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Loader2, Search, AlertCircle, ShieldCheck, ShieldAlert, ShieldX,
  Users, GraduationCap, ChevronDown, ChevronRight, UserCircle, Filter,
} from 'lucide-react';
import { complianceDaysUntil } from '@/utils/complianceDate';

const QUAL_TYPES = [
  { key: 'cscs_card', label: 'CSCS', short: 'CSCS' },
  { key: 'cpcs_card', label: 'CPCS', short: 'CPCS' },
  { key: 'npors_card', label: 'NPORS', short: 'NPORS' },
  { key: 'first_aid_cert', label: 'First Aid', short: 'FA' },
  { key: 'driver_license', label: 'Driving Licence', short: 'DL' },
  { key: 'dbs_certificate', label: 'DBS', short: 'DBS' },
  { key: 'forklift', label: 'Forklift', short: 'FLT' },
  { key: 'other', label: 'Other', short: 'OTH' },
];

// Unified status logic — aligned with TrainingGapAnalysis.
// A compliance item with no expiry date is 'compliant' (On File),
// NOT 'unknown', so a CSCS card saved without an expiry still shows a ✓.
function getStatus(complianceItem) {
  if (!complianceItem) return 'missing';
  if (complianceItem.status_override === 'not_required') return 'na';
  if (complianceItem.status_override === 'missing') return 'missing';
  if (!complianceItem.expiry_date) return 'compliant';
  const days = complianceDaysUntil(complianceItem.expiry_date);
  if (days === null) return 'compliant';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'compliant';
}

const STATUS_STYLES = {
  compliant: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Valid', icon: ShieldCheck, symbol: '✓' },
  expiring: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Expiring', icon: ShieldAlert, symbol: '⚠' },
  expired: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Expired', icon: ShieldX, symbol: '✗' },
  missing: { bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300', label: 'Missing', icon: AlertCircle, symbol: '?' },
  na: { bg: 'bg-slate-50', text: 'text-slate-300', dot: 'bg-slate-200', label: 'N/A', icon: ShieldCheck, symbol: '—' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'compliant', label: 'Valid' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'missing', label: 'Missing' },
];

// Mini progress ring — shows compliant % as a filled arc
function ProgressRing({ pct, size = 44 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1)' }}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

export default function SkillsMatrix() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState({});

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-skills-matrix'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: complianceItems = [], isLoading: compLoading } = useQuery({
    queryKey: ['compliance-items-staff-matrix'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });

  const itemMap = useMemo(() => {
    const map = {};
    for (const c of complianceItems) {
      const key = `${c.reference_id || c.reference_name}|${c.qualification_type || 'other'}`;
      map[key] = c;
    }
    return map;
  }, [complianceItems]);

  // Build per-staff compliance data
  const staffData = useMemo(() => {
    return staff.map(s => {
      const quals = QUAL_TYPES.map(qt => {
        const item = itemMap[`${s.id}|${qt.key}`];
        const status = getStatus(item);
        return { ...qt, status, item, expiry: item?.expiry_date };
      });
      const compliant = quals.filter(q => q.status === 'compliant').length;
      const actionable = quals.filter(q => q.status === 'expired' || q.status === 'missing').length;
      const expiring = quals.filter(q => q.status === 'expiring').length;
      const pct = quals.length > 0 ? Math.round((compliant / quals.length) * 100) : 0;
      return { staff: s, quals, compliant, actionable, expiring, pct };
    });
  }, [staff, itemMap]);

  // Training gaps — staff with expired or missing certs
  const gaps = useMemo(() => {
    return staffData
      .filter(d => d.actionable > 0 || d.expiring > 0)
      .sort((a, b) => b.actionable - a.actionable || b.expiring - a.expiring);
  }, [staffData]);

  // Group by job_title (or "Unassigned" if blank)
  const grouped = useMemo(() => {
    const groups = {};
    staffData.forEach(d => {
      const key = d.staff.job_title || 'Unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [staffData]);

  // Apply search + status filter
  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    return grouped
      .map(([group, members]) => {
        let filtered = members;
        if (q) {
          filtered = filtered.filter(d =>
            (d.staff.name || '').toLowerCase().includes(q) ||
            (d.staff.job_title || '').toLowerCase().includes(q)
          );
        }
        if (statusFilter !== 'all') {
          // Keep staff who have at least one qual in the selected status
          filtered = filtered.filter(d => d.quals.some(qu => qu.status === statusFilter));
        }
        return [group, filtered];
      })
      .filter(([, members]) => members.length > 0);
  }, [grouped, search, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    let compliant = 0, expiring = 0, expired = 0, missing = 0;
    staffData.forEach(d => {
      d.quals.forEach(q => {
        if (q.status === 'compliant') compliant++;
        else if (q.status === 'expiring') expiring++;
        else if (q.status === 'expired') expired++;
        else if (q.status === 'missing') missing++;
      });
    });
    return { compliant, expiring, expired, missing };
  }, [staffData]);

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  if (staffLoading || compLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Valid</p>
          </div>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{stats.compliant}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Expiring</p>
          </div>
          <p className="text-xl font-bold text-amber-700 tabular-nums">{stats.expiring}</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldX className="w-3.5 h-3.5 text-rose-600" />
            <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wide">Expired</p>
          </div>
          <p className="text-xl font-bold text-rose-700 tabular-nums">{stats.expired}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Missing</p>
          </div>
          <p className="text-xl font-bold text-slate-600 tabular-nums">{stats.missing}</p>
        </div>
      </div>

      {/* Training Gaps alert — only show staff with issues */}
      {gaps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">Training Gaps — {gaps.length} staff need attention</h3>
          </div>
          <div className="divide-y divide-amber-50 max-h-48 overflow-y-auto">
            {gaps.map(d => (
              <div key={d.staff.id} className="px-4 py-2.5 flex items-center gap-3">
                <UserCircle className="w-7 h-7 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.staff.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{d.staff.job_title || '—'}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {d.quals.filter(q => q.status === 'expired').map(q => (
                    <span key={q.key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium" title={`${q.label} — expired`}>
                      {q.short} ✗
                    </span>
                  ))}
                  {d.quals.filter(q => q.status === 'missing').map(q => (
                    <span key={q.key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium" title={`${q.label} — not recorded`}>
                      {q.short} ?
                    </span>
                  ))}
                  {d.quals.filter(q => q.status === 'expiring').map(q => (
                    <span key={q.key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium" title={`${q.label} — expiring soon`}>
                      {q.short} ⚠
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Status filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff or job title..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {FILTER_OPTIONS.map(opt => {
            const active = statusFilter === opt.key;
            const count = opt.key === 'all' ? staffData.length : staffData.filter(d => d.quals.some(q => q.status === opt.key)).length;
            return (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/30'
                }`}
              >
                {opt.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped staff cards */}
      {filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No staff found</p>
          {statusFilter !== 'all' && <p className="text-xs text-slate-400 mt-1">Try a different status filter.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map(([group, members]) => {
            const isExpanded = expandedGroups[group] !== false; // default expanded
            const groupCompliant = members.filter(d => d.pct === 100).length;
            const groupPct = members.length > 0
              ? Math.round(members.reduce((s, d) => s + d.pct, 0) / members.length)
              : 0;
            return (
              <div key={group} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-800 flex-1">{group}</span>
                  <span className="text-xs text-slate-500">{members.length} staff · {groupCompliant} fully compliant</span>
                  <ProgressRing pct={groupPct} size={32} />
                </button>
                {/* Members */}
                {isExpanded && (
                  <div className="divide-y divide-slate-50">
                    {members.map(d => (
                      <div key={d.staff.id} className="px-4 py-3 hover:bg-slate-50/50 transition">
                        <div className="flex items-center gap-3">
                          {/* Progress ring */}
                          <ProgressRing pct={d.pct} />
                          {/* Name + title */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{d.staff.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {d.staff.job_title || 'No title'}
                              {d.staff.date_of_birth && <span className="text-slate-300"> · DOB {new Date(d.staff.date_of_birth + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                            </p>
                          </div>
                          {/* Qualification chips */}
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {d.quals.map(q => {
                              const style = STATUS_STYLES[q.status];
                              return (
                                <span
                                  key={q.key}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${style.bg} ${style.text} text-[10px] font-bold`}
                                  title={`${q.label}: ${style.label}${q.expiry ? ` (exp ${q.expiry})` : ''}`}
                                >
                                  {style.symbol}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {/* Mobile: expandable qual detail (tap a chip row to see labels) */}
                        <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                          {d.quals.filter(q => q.status !== 'compliant' && q.status !== 'na').map(q => {
                            const style = STATUS_STYLES[q.status];
                            return (
                              <span key={q.key} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} font-medium`}>
                                {q.short} · {style.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs pt-1">
        {Object.entries(STATUS_STYLES).filter(([k]) => k !== 'na').map(([key, style]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded ${style.bg} ${style.text} flex items-center justify-center text-[10px] font-bold`}>
              {style.symbol}
            </span>
            <span className="text-slate-500">{style.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="w-5 h-5 rounded bg-slate-50 text-slate-300 flex items-center justify-center text-[10px] font-bold">—</span>
          <span>N/A (not required)</span>
        </div>
      </div>
    </div>
  );
}