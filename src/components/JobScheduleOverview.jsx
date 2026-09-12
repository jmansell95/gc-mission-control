import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, Calendar, User, Truck, ShieldCheck, PlayCircle, CheckCircle2, MessageSquare,
  ChevronDown, ChevronsUpDown, HardHat, Briefcase, Cog, Clock, Ruler, Route, CalendarDays,
} from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { getCrewLabel } from '@/utils/terminology';
import SubcontractorCrewSection from '@/components/jobs/SubcontractorCrewSection';
import RigLinkPill from '@/components/rota/RigLinkPill';
import CrewStatCard from '@/components/jobs/CrewStatCard';
import CrewDetailModal from '@/components/jobs/CrewDetailModal';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const workerTypeBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

const SECTION_META = {
  direct_employee: { label: 'Direct Employees', icon: Users, badge: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-700' },
  subcontractor: { label: 'Subcontractors', icon: HardHat, badge: 'bg-orange-100 text-orange-700', iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
  agency: { label: 'Agency Staff', icon: Briefcase, badge: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-700' },
};

// Stat-focused crew roster — the redesigned Daily Schedule tab.
// Each crew member gets a premium stat card; clicking opens the full CrewDetailModal.
function AssignedStaffGroups({ assignedStaff, rotas, vehicles, primaryType, rigs, allStaff, onMemberClick }) {
  const groups = { direct_employee: [], subcontractor: [], agency: [] };
  assignedStaff.forEach(member => {
    const wt = member.worker_type || 'direct_employee';
    if (groups[wt]) groups[wt].push(member);
    else groups.direct_employee.push(member);
  });

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([wt, members]) => {
        if (members.length === 0) return null;
        const meta = SECTION_META[wt] || SECTION_META.direct_employee;
        const Icon = meta.icon;
        return (
          <div key={wt}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${meta.iconColor}`} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{meta.label}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${meta.badge}`}>
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {members.map(member => (
                <CrewStatCard
                  key={member.id}
                  member={member}
                  rotas={rotas}
                  rigs={rigs}
                  allStaff={allStaff}
                  primaryType={primaryType}
                  onClick={() => onMemberClick(member)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function JobScheduleOverview({ job, primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates }) {
  const [expandedDays, setExpandedDays] = useState(() => new Set(sortedDates.length <= 3 ? sortedDates : []));
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-schedule'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });

  const toggleDay = (date) => setExpandedDays(prev => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });
  const allExpanded = expandedDays.size === sortedDates.length;
  const toggleAll = () => allExpanded ? setExpandedDays(new Set()) : setExpandedDays(new Set(sortedDates));

  const weekGroups = useMemo(() => {
    const groups = [], seen = {};
    sortedDates.forEach(date => {
      const d = new Date(date + 'T00:00:00');
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');
      if (!seen[key]) { seen[key] = { key, weekStart, dates: [] }; groups.push(seen[key]); }
      seen[key].dates.push(date);
    });
    return groups;
  }, [sortedDates]);

  const toggleWeek = (key) => setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
  const firstWeekKey = weekGroups[0]?.key;
  const isWeekExpanded = (key) => expandedWeeks[key] ?? (key === firstWeekKey);

  return (
    <div className="space-y-6 mb-6">
      {/* Stat-focused crew roster */}
      <AssignedStaffGroups
        assignedStaff={assignedStaff}
        rotas={rotas}
        vehicles={vehicles}
        primaryType={primaryType}
        rigs={rigs}
        allStaff={allStaff}
        onMemberClick={setSelectedMember}
      />

      {/* Subcontractor crew names */}
      <SubcontractorCrewSection jobId={job?.id || ''} />

      {/* Daily Schedule — collapsible, grouped by week */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-blue-700" /></div>
          <h3 className="font-bold text-slate-900 text-sm">Daily Schedule</h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} {sortedDates.length === 1 ? 'day' : 'days'}</span>
            {sortedDates.length > 0 && (
              <button onClick={toggleAll} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100 transition">
                <ChevronsUpDown className="w-3.5 h-3.5" /> {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            )}
          </div>
        </div>
        {sortedDates.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">No shifts scheduled yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {weekGroups.map(group => {
              const weekOpen = isWeekExpanded(group.key);
              const weekEnd = addWeeks(group.weekStart, 1);
              return (
                <div key={group.key}>
                  <button onClick={() => toggleWeek(group.key)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${weekOpen ? '' : '-rotate-90'}`} />
                    <span className="text-sm font-semibold text-slate-700">Week of {format(group.weekStart, 'dd MMM yyyy')}</span>
                    <span className="text-xs text-slate-400">{format(group.weekStart, 'dd MMM')} – {format(new Date(weekEnd.getTime() - 86400000), 'dd MMM')}</span>
                    <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{group.dates.length} {group.dates.length === 1 ? 'day' : 'days'}</span>
                  </button>
                  {weekOpen && (
                    <div className="bg-slate-50/50">
                      {group.dates.map(date => {
                        const seenStaff = {};
                        const dayRotas = (rotasByDate[date] || []).filter(r => { if (seenStaff[r.staff_id]) return false; seenStaff[r.staff_id] = true; return true; });
                        const d = new Date(date + 'T00:00:00');
                        const isOpen = expandedDays.has(date);
                        const startedCount = dayRotas.filter(r => r.status === 'started').length;
                        const completedCount = dayRotas.filter(r => r.status === 'completed').length;
                        const briefedCount = dayRotas.filter(r => r.briefing_signed).length;
                        return (
                          <div key={date} className="border-t border-slate-100/70">
                            <button onClick={() => toggleDay(date)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-white transition text-left">
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                              <span className="text-sm font-semibold text-slate-900">{format(d, 'EEEE, dd MMM yyyy')}</span>
                              <span className="text-xs text-slate-400">{dayRotas.length} {dayRotas.length === 1 ? 'person' : 'people'}</span>
                              <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                                {briefedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{briefedCount} briefed</span>}
                                {startedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{startedCount} started</span>}
                                {completedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{completedCount} done</span>}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-5 pb-4 pt-1">
                                <div className="flex flex-wrap gap-2">
                                  {dayRotas.map(rota => {
                                    const member = allStaff.find(s => s.id === rota.staff_id);
                                    const vehicle = vehicles.find(v => v.id === rota.vehicle_id);
                                    const rig = rigs.find(g => g.id === rota.rig_asset_id);
                                    return (
                                      <button key={rota.id} onClick={() => member && setSelectedMember(member)}
                                        className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs shadow-sm hover:shadow-md hover:border-[#2E5A1A]/30 transition text-left min-w-[200px]">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <User className="w-3.5 h-3.5 text-slate-400" />
                                          <span className="font-semibold text-slate-800">{member?.name || 'Unknown'}</span>
                                          {vehicle && <><span className="text-slate-300">·</span><Truck className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500 font-mono">{vehicle.registration_number}</span></>}
                                          {rota.briefing_signed && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium ml-auto"><ShieldCheck className="w-3 h-3" /> Briefed</span>}
                                          {rota.status === 'started' && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"><PlayCircle className="w-3 h-3" /> Started</span>}
                                          {rota.status === 'completed' && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Done</span>}
                                        </div>
                                        {rig && <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#2E5A1A]"><Cog className="w-3 h-3" /> {rig.name}</div>}
                                        {rota.progress_notes && <div className="flex items-start gap-1.5 mt-1.5 pl-5"><MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" /><p className="text-slate-500 leading-relaxed">{rota.progress_notes}</p></div>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crew detail modal */}
      <CrewDetailModal
        open={!!selectedMember}
        member={selectedMember}
        rotas={rotas}
        rigs={rigs}
        allStaff={allStaff}
        job={job}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}