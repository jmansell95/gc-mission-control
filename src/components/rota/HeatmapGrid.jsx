import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Users, Cog, ChevronDown } from 'lucide-react';
import { STATUS_CONFIG, getRowSummary } from './heatmapUtils';
import DayDetailModal from './DayDetailModal';

const CELL_WIDTH = 7;
const ROW_HEIGHT = 28;
const NAME_WIDTH = 180;
const BUFFER = 15;

export default function HeatmapGrid({ days, staffRows, rigRows, staffStatus, rigStatus, showStaff, showRigs }) {
  const scrollRef = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportW, setViewportW] = useState(800);
  const [popover, setPopover] = useState(null);
  const [collapsedStaff, setCollapsedStaff] = useState(false);
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

  const quarters = useMemo(() => {
    const qs = {};
    days.forEach(d => {
      if (!qs[d.quarter]) qs[d.quarter] = { num: d.quarter, count: 0 };
      qs[d.quarter].count++;
    });
    return Object.values(qs);
  }, [days]);

  const months = useMemo(() => {
    const ms = [];
    let cur = null;
    days.forEach(d => {
      if (!cur || cur.monthNum !== d.monthNum) {
        if (cur) ms.push(cur);
        cur = { monthNum: d.monthNum, label: d.month, count: 1 };
      } else {
        cur.count++;
      }
    });
    if (cur) ms.push(cur);
    return ms;
  }, [days]);

  const todayIndex = days.findIndex(d => d.isToday);
  const todayLeft = NAME_WIDTH + todayIndex * CELL_WIDTH;

  const handleCellClick = (resource, dateStr, status) => {
    setPopover({ resource, dateStr, status });
  };

  const handleAssign = () => {
    window.location.href = '/admin?section=scheduling';
  };

  const renderRow = (resource, statusMap, isRig) => {
    const summary = getRowSummary(statusMap, days);
    const initials = (resource.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div key={resource.id} className="flex hover:bg-slate-50/50 transition" style={{ height: `${ROW_HEIGHT}px` }}>
        <div className="flex items-center gap-1.5 px-2 flex-shrink-0 bg-white border-r border-slate-200 z-10" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 ${isRig ? 'bg-blue-500' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]'}`}>
            {initials}
          </div>
          <p className="text-[11px] font-semibold text-slate-700 truncate flex-1">{resource.name}</p>
          <span className="text-[9px] font-bold text-emerald-600 tabular-nums">{summary.job}</span>
          <span className="text-[9px] font-bold text-slate-400 tabular-nums">{summary.available}</span>
        </div>
        <div className="flex" style={{ width: `${totalWidth}px` }}>
          {leftSpacerW > 0 && <div style={{ width: `${leftSpacerW}px`, flexShrink: 0 }} />}
          {visibleDays.map(d => {
            const s = statusMap.get(d.dateStr);
            const cfg = STATUS_CONFIG[s?.type] || STATUS_CONFIG.available;
            return (
              <div
                key={d.dateStr}
                onClick={() => handleCellClick(resource, d.dateStr, s)}
                className={`${cfg.bg} ${d.isWeekend ? 'opacity-60' : ''} ${d.isToday ? 'ring-1 ring-[#2E5A1A] ring-inset' : ''} cursor-pointer hover:brightness-110 transition`}
                style={{ width: `${CELL_WIDTH}px`, height: '100%', flexShrink: 0 }}
                title={`${resource.name} · ${d.dateStr} · ${cfg.label}${s?.job_name ? ` · ${s.job_name}` : ''}`}
              />
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
          {/* Quarter header */}
          <div className="flex bg-[#2E5A1A] border-b border-[#1c4a12]" style={{ height: '26px' }}>
            <div className="flex items-center px-2 flex-shrink-0 bg-[#2E5A1A] border-r border-[#1c4a12] z-10 text-white text-[10px] font-bold uppercase tracking-wider" style={{ position: 'sticky', left: 0, width: `${NAME_WIDTH}px` }}>
              {new Date().getFullYear()} Overview
            </div>
            {quarters.map(q => (
              <div key={q.num} className="flex items-center justify-center text-white text-[10px] font-bold border-r border-[#1c4a12]/40" style={{ width: `${q.count * CELL_WIDTH}px`, flexShrink: 0 }}>
                Q{q.num}
              </div>
            ))}
          </div>

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
            <div className="absolute pointer-events-none" style={{ left: `${todayLeft}px`, top: '48px', bottom: 0, width: '2px', background: '#2E5A1A', zIndex: 5, opacity: 0.6 }} />
          )}

          {/* Staff section */}
          {showStaff && renderSectionHeader('Staff', Users, staffRows.length, 'text-[#2E5A1A]', collapsedStaff, () => setCollapsedStaff(v => !v))}
          {showStaff && !collapsedStaff && staffRows.map(s => renderRow(s, staffStatus.get(s.id) || new Map(), false))}
          {showStaff && collapsedStaff && (
            <div className="flex items-center justify-center bg-slate-50 text-[10px] text-slate-400 py-1 border-b border-slate-100" style={{ height: '24px' }}>
              {staffRows.length} staff hidden — click header to expand
            </div>
          )}

          {/* Rigs section */}
          {showRigs && renderSectionHeader('Rigs', Cog, rigRows.length, 'text-blue-600', collapsedRigs, () => setCollapsedRigs(v => !v))}
          {showRigs && !collapsedRigs && rigRows.map(r => renderRow(r, rigStatus.get(r.id) || new Map(), true))}
          {showRigs && collapsedRigs && (
            <div className="flex items-center justify-center bg-slate-50 text-[10px] text-slate-400 py-1 border-b border-slate-100" style={{ height: '24px' }}>
              {rigRows.length} rigs hidden — click header to expand
            </div>
          )}
        </div>
      </div>

      {popover && (
        <DayDetailModal
          resource={popover.resource}
          dateStr={popover.dateStr}
          status={popover.status}
          onClose={() => setPopover(null)}
          onAssign={handleAssign}
        />
      )}
    </div>
  );
}