import React from 'react';
import { Pencil, Trash2, Lock, Users, Building2, ShieldCheck, Eye, Crown, Layers } from 'lucide-react';
import { normalizePermissions } from '@/utils/permissions';
import AccessMatrixEditor from './AccessMatrixEditor';
import AccessGroupStaffManager from './AccessGroupStaffManager';

const TIER_BADGES = {
  full: { label: 'Full Access', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  office: { label: 'Office Staff', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  field: { label: 'Field Team', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'read-only': { label: 'Read Only', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

function getTier(group, p) {
  if (group.is_read_only) return 'read-only';
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  if (writeCount === Object.keys(p).length) return 'full';
  if (writeCount > 0) return 'office';
  return 'field';
}

/**
 * AccessGroupDetail — the right pane of the Access Manager.
 * Shows the selected group's header (name, tier, staff count, edit/delete)
 * and embeds the inline AccessMatrixEditor (division tabs + matrix + preview).
 */
export default function AccessGroupDetail({ group, groups, staffCount, divisions, overrideCount, onEdit, onDelete, lockedDivisionId = null }) {
  const p = normalizePermissions(group.permissions);
  const tier = getTier(group, p);
  const badge = TIER_BADGES[tier];
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const noneCount = Object.values(p).filter(v => v === 'none').length;
  const total = Object.keys(p).length;

  return (
    <div className="space-y-4">
      {/* ─── Group Header ─── */}
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {group.is_read_only && <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              <h2 className="text-lg font-extrabold text-slate-900 truncate">{group.name}</h2>
              {group.is_system && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" /> SYSTEM
                </span>
              )}
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
            {group.description && (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{group.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
              <Pencil className="w-3.5 h-3.5" /> Edit Base
            </button>
            {!group.is_system && (
              <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-slate-700 tabular-nums">{staffCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Staff</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <Building2 className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            {lockedDivisionId ? (
              <>
                <p className="text-sm font-extrabold text-slate-700 truncate px-1" title={divisions[0]?.name}>{divisions[0]?.name || 'This stream'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">This Stream</p>
              </>
            ) : (
              <>
                <p className="text-lg font-extrabold text-slate-700 tabular-nums">{divisions.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Business Streams</p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <Layers className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-amber-600 tabular-nums">{overrideCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Overrides</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <ShieldCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-emerald-600 tabular-nums">{writeCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Full Access</p>
          </div>
        </div>

        {/* Permission bar */}
        <div className="mt-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-emerald-500" style={{ width: `${(writeCount / total) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(readCount / total) * 100}%` }} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold">
            <span className="text-emerald-600 flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />{writeCount} full</span>
            <span className="text-amber-600 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{readCount} read</span>
            <span className="text-slate-400 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />{noneCount} hidden</span>
          </div>
        </div>

        {/* Division coverage dots */}
        {divisions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1 self-center">Active in:</span>
            {divisions.map(d => (
              <span key={d.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: d.color || '#2E5A1A' }}>
                {d.code || d.name?.substring(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Staff in this Group (assign / reassign) ─── */}
      <AccessGroupStaffManager group={group} groups={groups} />

      {/* ─── Inline Matrix Editor (division tabs + matrix + preview) ─── */}
      <AccessMatrixEditor fixedGroup={group} inline lockedDivisionId={lockedDivisionId} />
    </div>
  );
}