import React, { useState, useMemo } from 'react';
import { Users, Calendar, User, Truck, ShieldCheck, PlayCircle, CheckCircle2, MessageSquare, ChevronDown, ChevronsUpDown, HardHat, Briefcase } from 'lucide-react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { getCrewLabel } from '@/utils/terminology';
import SubcontractorCrewSection from '@/components/jobs/SubcontractorCrewSection';

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

function AssignedStaffGroups({ assignedStaff, rotas, vehicles, primaryType }) {
  const groups = {
    direct_employee: [],
    subcontractor: [],
    agency: [],
  };
  assignedStaff.forEach(member => {
    const wt = member.worker_type || 'direct_employee';
    if (groups[wt]) groups[wt].push(member);
    else groups.direct_employee.push(member);
  });

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([wt, members]) => {
        const meta = SECTION_META[wt] || SECTION_META.direct_employee;
        const Icon = meta.icon;
        return (
          <div key={wt} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${meta.iconColor}`} />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{meta.label}</h3>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </span>
            </div>
            {members.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-400 text-sm">None assigned</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map(member => {
                  const memberRotas = rotas.filter(r => r.staff_id === member.id);
                  const memberVehicleIds = [...new Set(memberRotas.map(r => r.vehicle_id).filter(Boolean))];
                  const memberVehicles = memberVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);
                  return (
                    <div key={member.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-slate-600 font-bold text-sm">{member.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                          <p className="text-xs text-slate-500">{roleLabels[member.job_role] || getCrewLabel(primaryType, 1)}</p>
                          {memberVehicles.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs text-slate-500">{memberVehicles.map(v => v.registration_number).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${workerTypeBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>
                          {member.worker_type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400">{memberRotas.length} {memberRotas.length === 1 ? 'shift' : 'shifts'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JobScheduleOverview({ primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates }) {
  const [expandedDays, setExpandedDays] = useState(() => new Set(sortedDates.length <= 3 ? sortedDates : []));
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const toggleDay = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const allExpanded = expandedDays.size === sortedDates.length;
  const toggleAll = () => {
    if (allExpanded) setExpandedDays(new Set());
    else setExpandedDays(new Set(sortedDates));
  };

  // Group dates by week for a more organised, scannable layout
  const weekGroups = useMemo(() => {
    const groups = [];
    const seen = {};
    sortedDates.forEach(date => {
      const d = new Date(date + 'T00:00:00');
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');
      if (!seen[key]) {
        seen[key] = { key, weekStart, dates: [] };
        groups.push(seen[key]);
      }
      seen[key].dates.push(date);
    });
    return groups;
  }, [sortedDates]);

  const toggleWeek = (key) => {
    setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Default: expand the first week so the user sees something without clicking
  const firstWeekKey = weekGroups[0]?.key;
  const isWeekExpanded = (key) => expandedWeeks[key] ?? (key === firstWeekKey);

  return (
    <div className="space-y-6 mb-6">
      {/* Assigned Staff — split by worker type */}
      <AssignedStaffGroups assignedStaff={assignedStaff} rotas={rotas} vehicles={vehicles} primaryType={primaryType} />

      {/* Subcontractor crew names (from SubcontractorLog — free-text names not in Staff records) */}
      <SubcontractorCrewSection jobId={rotas[0]?.job_id || ''} />

      {/* Daily Schedule — collapsible, grouped by week */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-blue-700" /></div>
          <h3 className="font-semibold text-slate-900 text-sm">Daily Schedule</h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} {sortedDates.length === 1 ? 'day' : 'days'}</span>
            {sortedDates.length > 0 && (
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100 transition"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                {allExpanded ? 'Collapse all' : 'Expand all'}
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
              const weekStart = group.weekStart;
              const weekEnd = addWeeks(weekStart, 1);
              return (
                <div key={group.key}>
                  {/* Week header — clickable to expand/collapse */}
                  <button
                    onClick={() => toggleWeek(group.key)}
                    className="w-full px-5 py-3 flex items-center gap-2 hover:bg-slate-50 transition text-left"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${weekOpen ? '' : '-rotate-90'}`} />
                    <span className="text-sm font-semibold text-slate-700">
                      Week of {format(weekStart, 'dd MMM yyyy')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(weekStart, 'dd MMM')} – {format(new Date(weekEnd.getTime() - 86400000), 'dd MMM')}
                    </span>
                    <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{group.dates.length} {group.dates.length === 1 ? 'day' : 'days'}</span>
                  </button>

                  {/* Days within the week */}
                  {weekOpen && (
                    <div className="bg-slate-50/50">
                      {group.dates.map(date => {
                        const _rawDayRotas = rotasByDate[date];
                        const _seenStaff = {};
                        const dayRotas = _rawDayRotas.filter(r => {
                          if (_seenStaff[r.staff_id]) return false;
                          _seenStaff[r.staff_id] = true;
                          return true;
                        });
                        const d = new Date(date + 'T00:00:00');
                        const isOpen = expandedDays.has(date);

                        // Quick status summary for the collapsed row
                        const startedCount = dayRotas.filter(r => r.status === 'started').length;
                        const completedCount = dayRotas.filter(r => r.status === 'completed').length;
                        const briefedCount = dayRotas.filter(r => r.briefing_signed).length;

                        return (
                          <div key={date} className="border-t border-slate-100/70">
                            {/* Day header — clickable to expand/collapse */}
                            <button
                              onClick={() => toggleDay(date)}
                              className="w-full px-5 py-3 flex items-center gap-2 hover:bg-white transition text-left"
                            >
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                              <span className="text-sm font-semibold text-slate-900">{format(d, 'EEEE, dd MMM yyyy')}</span>
                              <span className="text-xs text-slate-400">{dayRotas.length} {dayRotas.length === 1 ? 'person' : 'people'}</span>
                              <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                                {briefedCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{briefedCount} briefed</span>
                                )}
                                {startedCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{startedCount} started</span>
                                )}
                                {completedCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{completedCount} done</span>
                                )}
                              </div>
                            </button>

                            {/* Expanded day details */}
                            {isOpen && (
                              <div className="px-5 pb-4 pt-1">
                                <div className="flex flex-wrap gap-2">
                                  {dayRotas.map(rota => {
                                    const member = allStaff.find(s => s.id === rota.staff_id);
                                    const vehicle = vehicles.find(v => v.id === rota.vehicle_id);
                                    return (
                                      <div key={rota.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <User className="w-3.5 h-3.5 text-slate-400" />
                                          <span className="font-medium text-slate-700">{member?.name || 'Unknown'}</span>
                                          {vehicle && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                                              <span className="text-slate-500 font-mono">{vehicle.registration_number}</span>
                                            </>
                                          )}
                                          {rota.briefing_signed && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium ml-auto">
                                              <ShieldCheck className="w-3 h-3" /> Briefing {rota.briefing_signed_at ? format(new Date(rota.briefing_signed_at), 'HH:mm') : ''}
                                            </span>
                                          )}
                                          {rota.status === 'started' && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                              <PlayCircle className="w-3 h-3" /> Started
                                            </span>
                                          )}
                                          {rota.status === 'completed' && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                              <CheckCircle2 className="w-3 h-3" /> Done
                                            </span>
                                          )}
                                        </div>
                                        {rota.progress_notes && (
                                          <div className="flex items-start gap-1.5 mt-1.5 pl-5">
                                            <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-slate-500 leading-relaxed">{rota.progress_notes}</p>
                                          </div>
                                        )}
                                      </div>
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
    </div>
  );
}