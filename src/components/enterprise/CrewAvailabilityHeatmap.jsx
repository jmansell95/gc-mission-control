import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, startOfWeek } from 'date-fns';
import { Users, ChevronLeft, ChevronRight, ArrowRight, Cog, MapPin, Wrench } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCrewAvailability, HEATMAP_LEGEND } from '@/hooks/useCrewAvailability';

const PREVIEW_COUNT = 12;

export default function CrewAvailabilityHeatmap() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { staff, divMap, days, dayStrs, getCellStatus, stats } = useCrewAvailability(weekStart);
  const [selectedCell, setSelectedCell] = useState(null);

  // Fetch today's rig deployment for the "Rigs in the Field" strip
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: rigMatrix } = useQuery({
    queryKey: ['availability-matrix', new Date().getFullYear(), ''],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailabilityMatrix', { year: new Date().getFullYear(), division_id: '' });
      return res.data;
    },
  });

  const rigStats = useMemo(() => {
    if (!rigMatrix?.rigs) return { total: 0, onSite: 0, available: 0, maintenance: 0 };
    let onSite = 0, available = 0, maintenance = 0;
    for (const rig of rigMatrix.rigs) {
      const todayAssignment = (rigMatrix.assignments || []).find(a => a.rig_asset_id === rig.id && a.assigned_date === today);
      if (todayAssignment) onSite++;
      else available++;
    }
    return { total: rigMatrix.rigs.length, onSite, available, maintenance };
  }, [rigMatrix, today]);

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Crew Availability Heatmap</h3>
            <p className="text-xs text-slate-500">All divisions · {stats.total} crew members</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs font-semibold text-slate-600 px-2 whitespace-nowrap tabular-nums">
            {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM')}
          </span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ── Rigs in the Field Today ── */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Cog className="w-3.5 h-3.5 text-[#2E5A1A]" />
            <span className="text-xs font-bold text-slate-700">Rigs in the Field Today</span>
          </div>
          <button
            onClick={() => navigate('/enterprise/crew-availability')}
            className="text-[10px] font-bold text-[#2E5A1A] hover:underline flex items-center gap-0.5"
          >
            View Heatmap <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <RigStatChip icon={MapPin} label="On Site" value={rigStats.onSite} color="text-emerald-700 bg-emerald-100" />
          <RigStatChip icon={Cog} label="Available" value={rigStats.available} color="text-blue-700 bg-blue-100" />
          <RigStatChip icon={Wrench} label="Total" value={rigStats.total} color="text-slate-700 bg-slate-100" />
        </div>
      </div>

      {/* Crew stats */}
      <div className="flex gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Job · {stats.onJobCount}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <span className="w-2 h-2 rounded-full bg-slate-300" /> Free · {stats.freeCount}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Leave · {stats.leaveCount}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-semibold text-slate-500 pb-2 pr-2 sticky left-0 bg-white z-10 min-w-[120px]">
                Crew Member
              </th>
              {days.map(d => (
                <th key={d.toISOString()} className="text-center font-semibold text-slate-500 pb-2 px-1 min-w-[36px]">
                  <div className="text-[10px] uppercase">{format(d, 'EEE')}</div>
                  <div className="text-slate-400 font-normal">{format(d, 'dd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.slice(0, PREVIEW_COUNT).map(s => {
              const divColor = divMap[s.division_id]?.color || '#94a3b8';
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: divColor }} />
                      <span className="text-slate-700 font-medium truncate max-w-[100px]">{s.name}</span>
                    </div>
                  </td>
                  {dayStrs.map(dStr => {
                    const cell = getCellStatus(s.id, dStr);
                    return (
                      <td key={dStr} className="text-center py-1 px-1">
                        <button
                          onClick={() => setSelectedCell({ staffId: s.id, staffName: s.name, date: dStr, status: cell.status })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold transition hover:scale-110"
                          style={{
                            background: cell.color || '#f1f5f9',
                            color: cell.color ? 'white' : '#cbd5e1',
                          }}
                          title={`${s.name} — ${cell.status}`}
                        >
                          {cell.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {staff.length > PREVIEW_COUNT && (
          <p className="text-xs text-center text-slate-400 pt-2">
            +{staff.length - PREVIEW_COUNT} more crew members…
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
        {HEATMAP_LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/enterprise/crew-availability')}
        className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition"
      >
        View all crew <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function RigStatChip({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${color}`}>
      <Icon className="w-3 h-3" />
      <div className="min-w-0">
        <p className="text-[8px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-sm font-extrabold tabular-nums leading-none">{value}</p>
      </div>
    </div>
  );
}