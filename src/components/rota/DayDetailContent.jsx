import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Briefcase, Coffee, Stethoscope, Users, Warehouse, Wrench, CalendarPlus, Cog, MapPin } from 'lucide-react';
import { STATUS_CONFIG } from './heatmapUtils';

const TYPE_ICON = {
  job: Briefcase, annual_leave: Coffee, sick: Stethoscope, training: Users,
  yard_depot: Warehouse, maintenance: Wrench, available: CalendarPlus,
  planning: CalendarPlus,
};

/**
 * Shared day-detail content — rendered inside either the centered modal
 * (mobile/tablet) or the side drawer (desktop). Extracted from the old
 * HeatmapCellPopover so both breakpoints show identical information.
 */
export default function DayDetailContent({ resource, dateStr, status, onClose, onAssign }) {
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

  const initials = (resource.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header: avatar + name + date */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${resource.type === 'rig' ? 'bg-blue-500' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]'}`}>
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">{resource.name}</p>
          <p className="text-sm text-slate-500">{formattedDate}</p>
        </div>
      </div>

      {/* Status badge row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${cfg.bg} text-white`}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
        {resource.type === 'rig' && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">RIG</span>
        )}
        {resource.rig_type && resource.rig_type !== 'n/a' && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">{resource.rig_type}</span>
        )}
        {resource.team_name && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 truncate max-w-[150px]">{resource.team_name}</span>
        )}
      </div>

      {/* Job assignment card */}
      {status?.job_name && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Assigned Job</p>
          <p className="text-base font-semibold text-slate-800">{status.job_name}</p>
          {status.job_reference && (
            <p className="text-sm text-slate-500 font-mono mt-1">{status.job_reference}</p>
          )}
          {status.crew_role && (
            <p className="text-xs text-slate-500 mt-2">
              Role: {status.crew_role === 'lead_driller' ? 'Lead Driller' : 'Second Man'}
            </p>
          )}
        </div>
      )}

      {/* Planning block card */}
      {status?.type === 'planning' && status.block_name && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">Tentative Block</p>
          <p className="text-base font-semibold text-amber-800">{status.block_name}</p>
        </div>
      )}

      {/* Available message */}
      {status?.type === 'available' && (
        <p className="text-sm text-slate-500">This resource is free on this day. Click assign to schedule them.</p>
      )}

      {/* Location */}
      {resource.location && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="w-4 h-4" /> {resource.location}
        </div>
      )}

      {/* Assign button */}
      <button
        onClick={handleAssign}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2E5A1A] text-white text-sm font-bold hover:bg-[#1c4a12] transition shadow-sm"
      >
        <CalendarPlus className="w-4 h-4" /> Assign to Job
      </button>
    </div>
  );
}