import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Users, Cog, ChevronDown, HardHat, Building2, Briefcase } from 'lucide-react';
import { STATUS_CONFIG, getRowSummary, groupStaffByWorkerType } from './heatmapUtils';
import StaffBadges from './StaffBadges';
import HeatmapCellPopover from './HeatmapCellPopover';

const CELL_WIDTH = 7;
const ROW_HEIGHT = 28;
const NAME_WIDTH = 220;
const BUFFER = 15;

export default function YearHeatmapGrid({ days, staffRows, rigRows, staffStatus, rigStatus, onPlanningBlockClick }) {
  const scrollRef = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportW, setViewportW] = useState(800);
  const [popover, setPopover] = useState(null);
  const [collapsedDirect, setCollapsedDirect] = useState(false);
  const [collapsedSub, setCollapsedSub] = useState(false);
  const [collapsedAgency, setCollapsedAgency] = useState(false);
  const [collapsedRigs, setCollapsedRigs] = useState(false);
  const rafRef = useRef(null);

  const numDays = days.length;
  const totalWidth = numDays * CELL_WIDTH;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportW(Math.max(200, el.clientWidth - NAME_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = (e) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollLeft(e.target.scrollLeft);
    });
  };

  const visStart = Math.max(0, Math.floor(scrollLeft / CELL_WIDTH) - BUFFER);
  const visEnd = Math.min(numDays, Math.ceil((scrollLeft + viewportW) / CELL_WIDTH) + BUFFER);
  const leftSpacerW = visStart * CELL_WIDTH;
  const rightSpacerW = (numDays - visEnd) * CELL_WIDTH;
  const visibleDays = days.slice(visStart, visEnd);

  const months = useMemo(() => {
    const ms = [];
    let cur = null;
    days.forEach(d => {
      if (!cur || cur.monthNum !== d.monthNum) {
        if (cur) ms.push(cur);
        cur = { monthNum: d.monthNum, label: d.month, count: 1 };
      } else cur.count++;
    });
    if (cur) ms.push(cur);
    return ms;
  }, [days]);

  const todayIndex = days.findIndex(d => d.isToday);
  const todayLeft = NAME_WIDTH + todayIndex * CELL_WIDTH;

  const handleCellClick = (resource, dateStr, status, isRig) => {
    if (status?.type === 'planning' && status.block_id && onPlanningBlockClick) {
      onPlanningBlockClick(status.block_id);
      return;
    }
    setPopover({ resource: { ...resource, type: isRig ? 'rig' : 'staff' }, dateStr, status });
  };

  const renderRow = (resource, statusMap, isRig) => {
    const summary = getRowSummary(statusMap, days);
    const workDays = summary.job + summary.available;
    const util = workDays > 0 ? Math.round((summary.job / workDays) * 100) : 0;
    const initials = (resource.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div key={resource.id} className="flex hover:bg-slate-50/50 transition" style={{ height: `${ROW_HEIGHT}px` }}>
        <div className="flex items-center gap-1.5 px-2 flex-shrink-0 bg-white border-r border-slate-200 z-10" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 ${isRig ? 'bg-blue-500' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]'}`}>
            {initials}
          </div>
          <p className="text-[11px] font-semibold text-slate-700 truncate flex-1">{resource.name}</p>
          {!isRig && <StaffBadges staff={resource} compact />}
          <span className="text-[9px] font-bold text-emerald-600 tabular-nums" title="Job days">{summary.job}</span>
          <span className="text-[9px] text-slate-300">/</span>
          <span className="text-[9px] font-bold text-slate-400 tabular-nums" title="Available days">{summary.available}</span>
          <span className={`text-[8px] font-bold tabular-nums px-1 rounded ${util >= 80 ? 'bg-emerald-100 text-emerald-700' : util >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{util}%</span>
        </div>
        <div className="flex" style={{ width: `${totalWidth}px` }}>
          {leftSpacerW > 0 && <div style={{ width: `${leftSpacerW}px`, flexShrink: 0 }} />}
          {visibleDays.map(d => {
            const s = statusMap.get(d.dateStr);
            const cfg = STATUS_CONFIG[s?.type] || STATUS_CONFIG.available;
            return (
              <div key={d.dateStr} onClick={() => handleCellClick(resource, d.dateStr, s, isRig)}
                className={`${cfg.bg} ${d.isWeekend ? 'opacity-50' : ''} ${d.isToday ? 'ring-1 ring-[#2E5A1A] ring-inset' : ''} cursor-pointer hover:brightness-125 hover:scale-y-110 transition-all rounded-sm`}
                style={{ width: `${CELL_WIDTH}px`, height: '100%', flexShrink: 0 }}
                title={`${resource.name} · ${d.dateStr} · ${cfg.label}${s?.job_name ? ` · ${s.job_name}` : ''}`} />
            );
          })}
          {rightSpacerW > 0 && <div style={{ width: `${rightSpacerW}px`, flexShrink: 0 }} />}
        </div>
      </div>
    );
  };

  const renderSectionHeader = (label, Icon, count, color, collapsed, onToggle) => (
    <div className="flex items-center bg-slate-50 border-y border-slate-200" style={{ height: '30px' }}>
      <div className="flex items-center gap-1.5 px-2 flex-shrink-0 bg-slate-100 border-r border-slate-200 z-10 cursor-pointer" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }} onClick={onToggle}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-bold text-slate-400">({count})</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-auto transition ${collapsed ? '-rotate-90' : ''}`} />
      </div>
      <div style={{ width: `${totalWidth}px` }} />
    </div>
  );

  return (
    <div className="relative insight-card rounded-2xl overflow-hidden">
      <div ref={scrollRef} onScroll={handleScroll} className="heatmap-grid-scroll overflow-x-auto overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div style={{ width: `${NAME_WIDTH + totalWidth}px`, position: 'relative' }}>
          {/* Month header */}
          <div className="flex bg-slate-100 border-b border-slate-200" style={{ height: '22px' }}>
            <div className="flex items-center px-2 flex-shrink-0 bg-slate-100 border-r border-slate-200 z-10 text-[9px] font-bold text-slate-500 uppercase" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
              Resource
            </div>
            {months.map(m => (
              <div key={m.monthNum} className="flex items-center justify-center text-[9px] font-semibold text-slate-500 border-r border-slate-200/60" style={{ width: `${m.count * CELL_WIDTH}px`, flexShrink: 0 }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* Today vertical line */}
          {todayIndex >= 0 && (
            <div className="absolute pointer-events-none" style={{ left: `${todayLeft}px`, top: '22px', bottom: 0, width: '2px', background: '#2E5A1A', zIndex: 5, opacity: 0.5 }} />
          )}

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

      {popover && (
        <HeatmapCellPopover resource={popover.resource} dateStr={popover.dateStr} status={popover.status}
          onClose={() => setPopover(null)} onAssign={() => { window.location.href = '/admin?section=scheduling'; }} />
      )}
    </div>
  );
}