import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import {
  Users, ArrowLeft, Search, Mail, Phone, Wrench, Building2,
  UserCheck, AlertCircle, ShieldCheck, HardHat, UserCog,
} from 'lucide-react';

export default function EnterpriseStaffHub() {
  const navigate = useNavigate();
  const { divisions, permittedDivisionIds } = useDivision();
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['enterprise-staff-all'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const divisionMap = useMemo(() => {
    const m = {};
    divisions.forEach(d => { m[d.id] = d; });
    return m;
  }, [divisions]);

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach(t => { m[t.id] = t; });
    return m;
  }, [teams]);

  // Staff grouped by division
  const staffByDivision = useMemo(() => {
    const groups = {};
    divisions.forEach(d => { groups[d.id] = []; });
    staff.forEach(s => {
      if (s.division_id && groups[s.division_id]) {
        groups[s.division_id].push(s);
      } else if (!s.division_id) {
        // Unassigned staff — put in a virtual group
        if (!groups['unassigned']) groups['unassigned'] = [];
        groups['unassigned'].push(s);
      }
    });
    return groups;
  }, [staff, divisions]);

  // Stats per division
  const divisionStats = useMemo(() => {
    return divisions.map(d => ({
      division: d,
      count: (staffByDivision[d.id] || []).length,
    })).filter(s => s.count > 0);
  }, [divisions, staffByDivision]);

  const totalStaff = staff.length;

  const q = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    let result = staff;
    if (divisionFilter !== 'all') {
      result = result.filter(s => s.division_id === divisionFilter);
    }
    if (q) {
      result = result.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.job_title || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (teamMap[s.team_id]?.name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [staff, divisionFilter, q, teamMap]);

  // Group filtered results by division for display
  const groupedFiltered = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.division_id || 'unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* Hero */}
      <div className="relative">
        <div className="hero-vibrant absolute inset-0 overflow-hidden" />
        <div className="relative px-4 xl:px-6 xl:pt-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate(-1)}
                  className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg hover:bg-white/20 transition"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-none truncate">
                    Enterprise Staff Hub
                  </h1>
                  <p className="text-xs sm:text-sm text-white/70 font-semibold mt-1 truncate">All crew members across every division</p>
                </div>
              </div>
            </div>

            {/* Hero metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="stat-gradient-brand rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Total Staff</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{totalStaff}</p>
                </div>
              </div>
              <div className="stat-gradient-blue rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Business Streams</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{divisionStats.length}</p>
                </div>
              </div>
              <div className="stat-gradient-emerald rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Active</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{staff.filter(s => s.is_active !== false).length}</p>
                </div>
              </div>
              <div className="stat-gradient-violet rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Subcontractors</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{staff.filter(s => s.worker_type === 'subcontractor').length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 xl:px-6 pb-24 xl:pb-6 space-y-4 max-w-7xl mx-auto">

        <div className="space-y-4">
        {/* Search + Division filters */}
        <div className="insight-card rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, email or team..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>
          {/* Division filter pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setDivisionFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${divisionFilter === 'all' ? 'bg-[#2E5A1A] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All Business Streams ({totalStaff})
            </button>
            {divisionStats.map(({ division, count }) => (
              <button
                key={division.id}
                onClick={() => setDivisionFilter(division.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${divisionFilter === division.id ? 'text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                style={divisionFilter === division.id ? { background: division.color || '#2E5A1A' } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: division.color || '#2E5A1A' }} />
                {division.name} ({count})
              </button>
            ))}
          </div>
          {/* Worker-type breakdown */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Workforce:</span>
            {[
              { label: 'Direct', count: staff.filter(s => s.worker_type === 'direct_employee').length, cls: 'bg-emerald-50 text-emerald-700' },
              { label: 'Subcontractor', count: staff.filter(s => s.worker_type === 'subcontractor').length, cls: 'bg-blue-50 text-blue-700' },
              { label: 'Agency', count: staff.filter(s => s.worker_type === 'agency').length, cls: 'bg-violet-50 text-violet-700' },
            ].map(w => (
              <span key={w.label} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${w.cls}`}>
                {w.label} <span className="tabular-nums">{w.count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Staff grid — grouped by division */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-white border border-slate-200 p-4 h-28" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="insight-card rounded-2xl p-10 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No staff match your filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFiltered).map(([divId, groupStaff]) => {
              const division = divisionMap[divId];
              const isUnassigned = divId === 'unassigned';
              const name = isUnassigned ? 'Unassigned' : (division?.name || 'Unknown');
              const color = isUnassigned ? '#94a3b8' : (division?.color || '#2E5A1A');
              return (
                <div key={divId}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <h2 className="text-base font-extrabold text-slate-900">{name}</h2>
                    <span className="text-xs font-semibold text-slate-400">({groupStaff.length})</span>
                    <div className="flex-1 h-px bg-slate-200 ml-2" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {groupStaff.map(s => {
                      const team = teamMap[s.team_id];
                      const initials = (s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                      const workerTypeMeta = {
                        direct_employee: { label: 'Direct', icon: HardHat, cls: 'bg-emerald-50 text-emerald-700' },
                        subcontractor: { label: 'Subcon', icon: Wrench, cls: 'bg-blue-50 text-blue-700' },
                        agency: { label: 'Agency', icon: UserCog, cls: 'bg-violet-50 text-violet-700' },
                      };
                      const wt = workerTypeMeta[s.worker_type] || workerTypeMeta.direct_employee;
                      const WtIcon = wt.icon;
                      return (
                        <div
                          key={s.id}
                          className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: color }}>
                              {s.avatar_url ? (
                                <img src={s.avatar_url} alt={s.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#2E5A1A] transition">{s.name}</p>
                                {s.is_active === false && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">INACTIVE</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{s.job_title || 'Staff'}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${wt.cls}`}>
                                  <WtIcon className="w-2.5 h-2.5" />
                                  {wt.label}
                                </span>
                                {team && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    <Wrench className="w-2.5 h-2.5" />
                                    {team.name || 'Team'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
                            {s.email && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{s.email}</span>
                              </span>
                            )}
                            {s.phone && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{s.phone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}