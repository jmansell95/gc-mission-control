import React from 'react';
import { Pencil, Trash2, Lock, Users, Building2, ShieldCheck, Eye, Crown, Layers } from 'lucide-react';
import { normalizePermissions, PERMISSION_MODULES } from '@/utils/permissions';

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

export default function AccessGroupCard({ group, staffCount, teamCount, divisions, overrideCount = 0, onEdit, onDelete, onLockdown }) {
  const p = normalizePermissions(group.permissions);
  const tier = getTier(group, p);
  const badge = TIER_BADGES[tier];
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const noneCount = Object.values(p).filter(v => v === 'none').length;
  const total = Object.keys(p).length;

  // Visual permission bar
  const writePct = (writeCount / total) * 100;
  const readPct = (readCount / total) * 100;

  return (
    <div className="hub-glass rounded-2xl p-4 flex flex-col group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {group.is_read_only && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            <h3 className="font-bold text-slate-900 truncate text-sm">{group.name}</h3>
            {group.is_system && (
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5" /> SYSTEM
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500 line-clamp-2 mb-3 flex-1 leading-relaxed">{group.description || 'No description'}</p>

      {/* Visual hub access dots — coloured by access level (green/amber/red) */}
      <div className="flex flex-wrap gap-1 mb-2">
        {PERMISSION_MODULES.map(m => {
          const level = p[m.key] || 'none';
          return (
            <span
              key={m.key}
              className={`w-2.5 h-2.5 rounded-full transition ${
                level === 'write' ? 'bg-emerald-500' :
                level === 'read' ? 'bg-amber-500' :
                'bg-rose-300'
              }`}
              title={`${m.label}: ${level === 'write' ? 'Full Access' : level === 'read' ? 'Read Only' : 'No Access'}`}
            />
          );
        })}
      </div>

      {/* Permission bar */}
      <div className="mb-3">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${writePct}%` }} />
          <div className="bg-amber-400" style={{ width: `${readPct}%` }} />
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold">
          <span className="text-emerald-600 flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />{writeCount} full</span>
          <span className="text-amber-600 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{readCount} read</span>
          <span className="text-slate-400 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />{noneCount} hidden</span>
        </div>
      </div>

      {/* Assignment + division coverage */}
      <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">{staffCount}</span> staff
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">{divisions.length}</span> div{divisions.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Division dots */}
      {divisions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {divisions.slice(0, 6).map(d => (
            <span key={d.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: d.color || '#2E5A1A' }}>
              {d.code || d.name?.substring(0, 3).toUpperCase()}
            </span>
          ))}
          {divisions.length > 6 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">+{divisions.length - 6}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
        <button onClick={onEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button onClick={onLockdown} className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition relative">
          <Layers className="w-3 h-3" /> Lockdown
          {overrideCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">{overrideCount}</span>
          )}
        </button>
        {!group.is_system && (
          <button onClick={onDelete} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}