import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Layers, Plus, Pencil, Trash2, Users, Loader2, AlertTriangle, Building2,
} from 'lucide-react';
import DivisionEditor from '@/components/settings/DivisionEditor';
import BusinessUnitCreateModal from '@/components/enterprise/BusinessUnitCreateModal';

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active', dot: 'bg-emerald-500' },
  setup: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Setup', dot: 'bg-amber-500' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', label: 'On Hold', dot: 'bg-slate-400' },
};

export default function BusinessUnitManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const { data: allDivisions = [], isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-division-mgr'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['divisions'] });
    queryClient.invalidateQueries({ queryKey: ['staff-division-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['ent-stats'] });
  };

  // BUs = top-level (parent null) AND has children — same logic as the Enterprise Dashboard.
  const businessUnits = useMemo(() => {
    const parentIds = new Set(allDivisions.filter(d => d.parent_division_id).map(d => d.parent_division_id));
    return allDivisions.filter(d => !d.parent_division_id && parentIds.has(d.id));
  }, [allDivisions]);

  const buChildren = useMemo(() => {
    const map = {};
    for (const d of allDivisions) {
      if (d.parent_division_id) {
        (map[d.parent_division_id] = map[d.parent_division_id] || []).push(d);
      }
    }
    return map;
  }, [allDivisions]);

  const divisionStaffCounts = useMemo(() => {
    const counts = {};
    for (const s of staff) {
      if (s.division_id) counts[s.division_id] = (counts[s.division_id] || 0) + 1;
    }
    return counts;
  }, [staff]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">Business Units</h2>
            <p className="text-sm text-slate-500">Top-level containers that house specialist business streams. Add business streams inside a BU from the <strong>Business Streams</strong> tab.</p>
          </div>
        </div>
      </div>

      {/* BUs grid */}
      <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl command-gradient text-white text-sm font-semibold shadow-md hover:shadow-lg transition">
            <Plus className="w-4 h-4" /> New Business Unit
          </button>
        </div>
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
        ) : businessUnits.length === 0 ? (
          <div className="hub-glass rounded-2xl p-8 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No business units yet</p>
            <p className="text-xs text-slate-400 mt-1">Create a top-level business unit, then add business streams inside it from the Business Streams tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {businessUnits.map(bu => {
              const st = STATUS_STYLES[bu.status || 'setup'] || STATUS_STYLES.setup;
              const children = buChildren[bu.id] || [];
              const childStaff = children.reduce((s, c) => s + (divisionStaffCounts[c.id] || 0), 0);
              return (
                <div key={bu.id} className="hub-glass relative rounded-2xl overflow-hidden">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${bu.color || '#2E5A1A'}, ${bu.color || '#2E5A1A'}99)` }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: `linear-gradient(135deg, ${bu.color || '#2E5A1A'}, ${bu.color || '#2E5A1A'}cc)` }}>
                          <Layers className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">{bu.name}</h3>
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{bu.code}</p>
                          {bu.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{bu.tagline}</p>}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text} ring-1 ${st.ring} flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                      </span>
                    </div>

                    {bu.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{bu.description}</p>}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{children.length}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Streams</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{childStaff}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Staff</p>
                        </div>
                      </div>
                    </div>

                    {children.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {children.slice(0, 4).map(c => (
                          <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{c.name}</span>
                        ))}
                        {children.length > 4 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{children.length - 4}</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                      <button onClick={() => setEditing(bu)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => setDeleting(bu)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <DivisionEditor
          division={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}

      {showCreate && (
        <BusinessUnitCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); invalidate(); }}
        />
      )}

      {deleting && (
        <DeleteBusinessUnitModal
          bu={deleting}
          initialChildren={buChildren[deleting.id] || []}
          allDivisions={allDivisions}
          onCancel={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); invalidate(); }}
          onReassigned={() => queryClient.invalidateQueries({ queryKey: ['divisions'] })}
        />
      )}
    </div>
  );
}

function DeleteBusinessUnitModal({ bu, initialChildren, allDivisions, onCancel, onDeleted, onReassigned }) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [children, setChildren] = useState(initialChildren);

  const otherBUs = allDivisions.filter(d => !d.parent_division_id && d.id !== bu.id);

  const reassign = async (childId, targetId) => {
    try {
      await base44.entities.Division.update(childId, { parent_division_id: targetId || null });
      setChildren(prev => prev.filter(c => c.id !== childId));
      onReassigned();
      toast({ title: targetId ? 'Business Stream reassigned' : 'Business Stream made standalone' });
    } catch (e) {
      toast({ title: 'Reassign failed', description: e.message, variant: 'destructive' });
    }
  };

  const removeChild = async (childId) => {
    try {
      await base44.entities.Division.delete(childId);
      setChildren(prev => prev.filter(c => c.id !== childId));
      onReassigned();
      toast({ title: 'Business Stream removed' });
    } catch (e) {
      toast({ title: 'Remove failed', description: e.message, variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    if (children.length > 0) return;
    setDeleting(true);
    try {
      await base44.entities.Division.delete(bu.id);
      toast({ title: 'Business Unit deleted' });
      onDeleted();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const blocked = children.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Delete "{bu.name}"?</h3>
            <p className="text-xs text-slate-500">{blocked ? 'Reassign or remove its business streams first.' : 'This action cannot be undone.'}</p>
          </div>
        </div>

        {blocked ? (
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">This business unit contains <strong>{children.length}</strong> business stream{children.length === 1 ? '' : 's'}. Reassign each to another BU (or make it standalone) before you can delete this BU.</p>
            </div>
            <div className="space-y-2">
              {children.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">{c.name}</span>
                  <select
                    value=""
                    onChange={e => { const v = e.target.value; reassign(c.id, v === '__standalone__' ? null : v); }}
                    className="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100 outline-none"
                  >
                    <option value="">Reassign to…</option>
                    {otherBUs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    <option value="__standalone__">Make standalone</option>
                  </select>
                  <button onClick={() => removeChild(c.id)} className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Deleting this business unit will remove its card from the Enterprise Dashboard and switcher. This cannot be undone.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={doDelete} disabled={deleting || blocked} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Business Unit
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}