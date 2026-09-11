import React, { useState } from 'react';
import { Users, Cog, ChevronDown, CalendarPlus, HardHat, Building2, Briefcase } from 'lucide-react';
import { STATUS_CONFIG, getRowSummary, groupStaffByWorkerType } from './heatmapUtils';
import StaffBadges from './StaffBadges';

const STATUS_LABEL = {
  job: 'On Job', annual_leave: 'AL', sick: 'Sick', training: 'Training',
  yard_depot: 'Depot', maintenance: 'Service', planning: 'Planning', available: 'Free',
};

export default function WeekListView({ days, staffRows, rigRows, staffStatus, rigStatus, onPlanningBlockClick, statusFilter, showWeekends, onCellClick, isCompact }) {
  const NAME_WIDTH = isCompact ? 130 : 220;
  const [collapsedDirect, setCollapsedDirect] = useState(false);
  const [collapsedSub, setCollapsedSub] = useState(false);
  const [collapsedAgency, setCollapsedAgency] = useState(false);
  const [collapsedRigs, setCollapsedRigs] = useState(false);

  const handleCellClick = (resource, dateStr, status, isRig) => {
    if (status?.type === 'planning' && status.block_id && onPlanningBlockClick) {
      onPlanningBlockClick(status.block_id);
      return;
    }
    onCellClick?.({ resource: { ...resource, type: isRig ? 'rig' : 'staff' }, dateStr, status });
  };

  const renderRow = (resource, statusMap, isRig) => {
    const summary = getRowSummary(statusMap, days);
    const workDays = summary.job + summary.available;
    const util = workDays > 0 ? Math.round((summary.job / workDays) * 100) : 0;
    const initials = (resource.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div key={resource.id} className="flex hover:bg-slate-50/50 transition border-b border-slate-100" style={{ minHeight: '52px' }}>
        <div className="flex items-center gap-2 px-3 flex-shrink-0 bg-white border-r border-slate-200 z-10" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${isRig ? 'bg-blue-500' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]'}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate">{resource.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{isRig ? (resource.make || resource.rig_type || 'Rig') : (resource.job_title || resource.team_name || '')}</p>
          </div>
          {!isRig && <StaffBadges staff={resource} />}
          <span className={`text-[8px] font-bold tabular-nums px-1.5 py-0.5 rounded ${util >= 80 ? 'bg-emerald-100 text-emerald-700' : util >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{util}%</span>
        </div>
        <div className="flex flex-1">
          {days.map(d => {
            const s = statusMap.get(d.dateStr);
            const cfg = STATUS_CONFIG[s?.type] || STATUS_CONFIG.available;
            const label = STATUS_LABEL[s?.type] || 'Free';
            const dimmed = (statusFilter?.size > 0 && s?.type && !statusFilter.has(s.type)) || (d.isWeekend && !showWeekends);
            return (
              <div key={d.dateStr} onClick={() => handleCellClick(resource, d.dateStr, s, isRig)}
                className={`flex-1 min-w-[80px] ${cfg.bg} ${d.isWeekend ? (showWeekends ? 'opacity-70' : 'opacity-10') : ''} ${d.isToday ? 'ring-2 ring-[#2E5A1A] ring-inset' : ''} ${dimmed ? 'opacity-20' : ''} cursor-pointer hover:brightness-110 transition-all p-2 flex flex-col justify-center min-h-[52px]`}>
                <p className="text-[10px] font-bold text-white/90 leading-tight">{label}</p>
                {s?.job_name && <p className="text-[9px] text-white/70 truncate mt-0.5">{s.job_name}</p>}
                {!s && <CalendarPlus className="w-3 h-3 text-slate-400" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSectionHeader = (label, Icon, count, color, collapsed, onToggle) => (
    <div className="flex items-center bg-slate-50 border-y border-slate-200" style={{ height: '30px' }}>
      <div className="flex items-center gap-1.5 px-3 flex-shrink-0 bg-slate-100 border-r border-slate-200 z-10 cursor-pointer" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }} onClick={onToggle}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-bold text-slate-400">({count})</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-auto transition ${collapsed ? '-rotate-90' : ''}`} />
      </div>
      <div className="flex flex-1" />
    </div>
  );

  return (
    <div className="relative insight-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div style={{ position: 'relative' }}>
          {/* Day header */}
          <div className="flex bg-slate-100 border-b border-slate-200" style={{ height: '44px' }}>
            <div className="flex items-center px-3 flex-shrink-0 bg-slate-100 border-r border-slate-200 z-10 text-[9px] font-bold text-slate-500 uppercase" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
              Resource
            </div>
            {days.map(d => (
              <div key={d.dateStr} className={`flex-1 min-w-[80px] flex flex-col items-center justify-center border-r border-slate-200/60 ${d.isWeekend ? (showWeekends ? 'bg-slate-200/50' : 'opacity-30') : ''} ${d.isToday ? 'bg-[#2E5A1A]/10' : ''}`}>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{d.weekday}</span>
                <span className={`text-sm font-bold ${d.isToday ? 'text-[#2E5A1A]' : 'text-slate-700'}`}>{d.day}</span>
              </div>
            ))}
          </div>

          {/* Staff sections grouped by worker type */}
          {(() => {
            const grouped = groupStaffByWorkerType(staffRows);
            const groups = [
              { key: 'direct_employee', label: 'Direct Employees', Icon: HardHat, color: 'text-[#2E5A1A]', collapsed: collapsedDirect, setCollapsed: setCollapsedDirect },
              { key: 'subcontractor', label: 'Subcontractors', Icon: Building2, color: 'text-amber-600', collapsed: collapsedSub, setCollapsed: setCollapsedSub },
              { key: 'agency', label: 'Agency Workers', Icon: Briefcase, color: 'text-violet-600', collapsed: collapsedAgency, setCollapsed: setCollapsedAgency },
            ];
            return groups.map(g => {
              const rows = grouped[g.key] || [];
              if (rows.length === 0) return null;
              return (
                <React.Fragment key={g.key}>
                  {renderSectionHeader(g.label, g.Icon, rows.length, g.color, g.collapsed, () => g.setCollapsed(v => !v))}
                  {!g.collapsed && rows.map(s => renderRow(s, staffStatus.get(s.id) || new Map(), false))}
                  {g.collapsed && (
                    <div className="flex items-center justify-center bg-slate-50 text-[10px] text-slate-400 py-1 border-b border-slate-100" style={{ height: '24px' }}>
                      {rows.length} hidden — click to expand
                    </div>
                  )}
                </React.Fragment>
              );
            });
          })()}

          {/* Rigs section */}
          {rigRows.length > 0 && renderSectionHeader('Rigs', Cog, rigRows.length, 'text-blue-600', collapsedRigs, () => setCollapsedRigs(v => !v))}
          {rigRows.length > 0 && !collapsedRigs && rigRows.map(r => renderRow(r, rigStatus.get(r.id) || new Map(), true))}
          {rigRows.length > 0 && collapsedRigs && (
            <div className="flex items-center justify-center bg-slate-50 text-[10px] text-slate-400 py-1 border-b border-slate-100" style={{ height: '24px' }}>
              {rigRows.length} rigs hidden — click header to expand
            </div>
          )}
        </div>
      </div>

    </div>
  );
}