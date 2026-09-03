import React, { useState, useRef, useEffect } from 'react';
import { Drill, X, User, Hash } from 'lucide-react';
import { hashPairingColor } from '@/hooks/useRigLink';

/**
 * RigLinkPill — compact "Rig: [name] [serial]" pill shown on any shift that
 * has a rig stamped (rig_asset_id). Rig-type-coloured (CP=amber, Rotary=blue),
 * with a pairing-colour bar so the two crew members on the same rig share a
 * matching accent. Click opens a popover with full rig details + crew partner
 * + remove-link action.
 *
 * Reused on the rota grid, job schedule tab, and field crew schedule so the
 * rig link looks identical everywhere.
 */
export default function RigLinkPill({ assignment, rigs, allAssignments, staff, onRemove, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!assignment?.rig_asset_id) return null;
  const rig = (rigs || []).find(r => r.id === assignment.rig_asset_id);
  if (!rig) return null;

  let partner = null;
  if (assignment.crew_pairing_id) {
    const p = (allAssignments || []).find(a =>
      a.crew_pairing_id === assignment.crew_pairing_id &&
      a.staff_id !== assignment.staff_id &&
      a.assigned_date === assignment.assigned_date
    );
    if (p) {
      const ps = (staff || []).find(s => s.id === p.staff_id);
      partner = { name: ps?.name || 'Unknown', role: p.crew_role };
    }
  }

  const pairingColor = hashPairingColor(assignment.crew_pairing_id);
  const isRotary = rig.rig_type === 'rotary';
  const shortSerial = rig.serial_number ? rig.serial_number.slice(-4) : '';
  const shortName = rig.name && rig.name.length > 12 ? rig.name.slice(0, 11) + '…' : (rig.name || 'Rig');
  const tone = isRotary
    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
  const padCls = size === 'xs' ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]';

  const titleParts = [rig.name];
  if (rig.serial_number) titleParts.push(rig.serial_number);
  if (rig.rig_type && rig.rig_type !== 'n/a') titleParts.push(`(${rig.rig_type.toUpperCase()})`);
  if (partner) titleParts.push(`· with ${partner.name}`);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={titleParts.join(' ')}
        className={`inline-flex items-center gap-1 ${padCls} rounded-md font-bold leading-none border transition ${tone}`}
      >
        <span className={`w-1 h-2.5 rounded-full ${pairingColor} flex-shrink-0`} />
        <Drill className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate max-w-[72px]">{shortName}</span>
        {shortSerial && <span className="opacity-60 font-mono">#{shortSerial}</span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 w-60 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 text-xs animate-pop-in">
          <div className="flex items-start gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isRotary ? 'bg-blue-100' : 'bg-amber-100'}`}>
              <Drill className={`w-4 h-4 ${isRotary ? 'text-blue-600' : 'text-amber-600'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 truncate">{rig.name}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                <Hash className="w-2.5 h-2.5" /> {rig.serial_number || 'No serial'}
                {rig.rig_type && rig.rig_type !== 'n/a' && (
                  <span className="ml-0.5 px-1 rounded bg-slate-100 text-slate-600 font-bold">{rig.rig_type.toUpperCase()}</span>
                )}
              </p>
            </div>
          </div>
          {partner && (
            <div className="flex items-center gap-1.5 mb-2 px-1.5 py-1 rounded-md bg-slate-50">
              <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">with</span>
              <span className="font-semibold text-slate-800 truncate flex-1">{partner.name}</span>
              <span className="text-[9px] text-slate-400 uppercase font-bold flex-shrink-0">
                {partner.role === 'lead_driller' ? 'Lead' : 'Second'}
              </span>
            </div>
          )}
          {assignment.crew_role && (
            <div className="text-[10px] text-slate-400 mb-2 px-1">
              This crew member: <span className="font-bold text-slate-600">{assignment.crew_role === 'lead_driller' ? 'Lead Driller' : 'Second Man'}</span>
            </div>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onRemove(assignment); }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition font-medium"
            >
              <X className="w-3 h-3" /> Remove rig link
            </button>
          )}
        </div>
      )}
    </div>
  );
}