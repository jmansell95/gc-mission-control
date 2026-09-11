import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { X, Briefcase, Coffee, Stethoscope, Users, Warehouse, Wrench, CalendarPlus, Cog, MapPin } from 'lucide-react';
import { STATUS_CONFIG } from './heatmapUtils';

const TYPE_ICON = {
  job: Briefcase, annual_leave: Coffee, sick: Stethoscope, training: Users,
  yard_depot: Warehouse, maintenance: Wrench, available: CalendarPlus,
  planning: CalendarPlus,
};

export default function HeatmapCellPopover({ resource, dateStr, status, onClose, onAssign }) {
  const navigate = useNavigate();
  if (!resource || !dateStr) return null;
  const cfg = STATUS_CONFIG[status?.type] || STATUS_CONFIG.available;
  const Icon = resource.type === 'rig' ? Cog : (TYPE_ICON[status?.type] || CalendarPlus);
  let formattedDate = dateStr;
  try { formattedDate = format(parseISO(dateStr), 'EEEE d MMM yyyy'); } catch {}

  const handleAssign = () => {
    onClose?.();
    if (onAssign) onAssign();
    else navigate('/admin?section=scheduling');
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 insight-card rounded-2xl p-5 w-80 animate-pop-in shadow-2xl">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{resource.name}</p>
              <p className="text-xs text-slate-500">{formattedDate}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} text-white`}>
              {cfg.label}
            </span>
            {resource.type === 'rig' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">RIG</span>}
            {resource.rig_type && resource.rig_type !== 'n/a' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">{resource.rig_type}</span>
            )}
            {resource.team_name && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[120px]">{resource.team_name}</span>}
          </div>

          {status?.job_name && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Assigned Job</p>
              <p className="text-sm font-semibold text-slate-800">{status.job_name}</p>
              {status.job_reference && <p className="text-xs text-slate-500 font-mono mt-0.5">{status.job_reference}</p>}
              {status.crew_role && <p className="text-[10px] text-slate-500 mt-1">Role: {status.crew_role === 'lead_driller' ? 'Lead Driller' : 'Second Man'}</p>}
            </div>
          )}

          {status?.type === 'planning' && status.block_name && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Tentative Block</p>
              <p className="text-sm font-semibold text-amber-800">{status.block_name}</p>
            </div>
          )}

          {status?.type === 'available' && (
            <p className="text-xs text-slate-500">This resource is free on this day. Click assign to schedule them.</p>
          )}

          {resource.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="w-3 h-3" /> {resource.location}
            </div>
          )}

          <button
            onClick={handleAssign}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-xs font-bold hover:bg-[#1c4a12] transition"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Assign to Job
          </button>
        </div>
      </div>
    </>
  );
}