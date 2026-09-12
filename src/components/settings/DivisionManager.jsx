import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Plus, Pencil, Trash2, Users, Loader2, AlertTriangle,
  Layers, Navigation,
} from 'lucide-react';
import DivisionEditor from '@/components/settings/DivisionEditor';
import DivisionWizard from '@/components/wizard/DivisionWizard';
import { resolveNavItems } from '@/utils/divisionNav';
import { DIVISION_TYPES } from '@/components/wizard/divisionWizardData';

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active', dot: 'bg-emerald-500' },
  setup: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Setup', dot: 'bg-amber-500' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', label: 'On Hold', dot: 'bg-slate-400' },
};

export default function DivisionManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(null);
  const [showWizard, setShowWizard] = React.useState(false);
  const [deleting, setDeleting] = React.useState(null);

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
  };

  // Partition using the same hierarchy logic as the Enterprise Dashboard:
  // BUs = top-level (parent null) AND has children. Everything else shows here.
  const { divisions, buNameMap } = useMemo(() => {
    const parentIds = new Set(allDivisions.filter(d => d.parent_division_id).map(d => d.parent_division_id));
    const buIds = new Set(allDivisions.filter(d => !d.parent_division_id && parentIds.has(d.id)).map(d => d.id));
    const divisions = allDivisions.filter(d => !buIds.has(d.id));
    const buNameMap = {};
    for (const d of allDivisions) {
      if (!d.parent_division_id) buNameMap[d.id] = d.name;
    }
    return { divisions, buNameMap };
  }, [allDivisions]);

  // Staff count per division
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
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">Business Streams</h2>
            <p className="text-sm text-slate-500">Operational business streams and standalone units. Business Units are managed in the <strong>Business Units</strong> tab. Staff assignment and access levels are managed in the <strong>Access Levels</strong> tab.</p>
          </div>
        </div>
      </div>

      {/* Divisions grid */}
      <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => setShowWizard(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl command-gradient text-white text-sm font-semibold shadow-md hover:shadow-lg transition">
            <Plus className="w-4 h-4" /> New Business Stream
          </button>
        </div>
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
        ) : divisions.length === 0 ? (
          <div className="hub-glass rounded-2xl p-8 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No business streams yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first business stream, or run the migration to auto-create the Geotechnical stream.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {divisions.map(d => {
              const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
              const staffCount = divisionStaffCounts[d.id] || 0;
              const hubCount = (d.enabled_hubs || []).length;
              const navCount = resolveNavItems(d).length;
              const typeLabel = (DIVISION_TYPES.find(t => t.value === d.division_type) || {}).label || d.division_type;
              return (
                <div key={d.id} className="hub-glass relative rounded-2xl overflow-hidden">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${d.color || '#2E5A1A'}, ${d.color || '#2E5A1A'}99)` }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: `linear-gradient(135deg, ${d.color || '#2E5A1A'}, ${d.color || '#2E5A1A'}cc)` }}>
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">{d.name}</h3>
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{d.code} {'\u00B7'} {typeLabel}</p>
                          {d.parent_division_id && buNameMap[d.parent_division_id] && (
                            <p className="text-[11px] text-emerald-700 font-semibold truncate mt-0.5">Part of {buNameMap[d.parent_division_id]}</p>
                          )}
                          {d.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{d.tagline}</p>}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text} ring-1 ${st.ring} flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                      </span>
                    </div>

                    {d.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{d.description}</p>}

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{staffCount}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Staff</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{hubCount}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Hubs</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 tabular-nums leading-none">{navCount}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Nav</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {(d.enabled_hubs || []).slice(0, 6).map(h => (
                        <span key={h} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">{h}</span>
                      ))}
                      {(d.enabled_hubs || []).length > 6 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{(d.enabled_hubs || []).length - 6}</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-3 border-t border-slate-100">
                      <button onClick={() => setEditing(d)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => setDeleting(d)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition">
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

      {/* Edit modal */}
      {editing && (
        <DivisionEditor
          division={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}

      {/* New division wizard */}
      {showWizard && (
        <DivisionWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); invalidate(); }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <DeleteDivisionModal
          division={deleting}
          staffCount={divisionStaffCounts[deleting.id] || 0}
          onCancel={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function DeleteDivisionModal({ division, staffCount, onCancel, onDeleted }) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const doDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Division.delete(division.id);
      toast({ title: 'Business Stream deleted' });
      onDeleted();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Delete "{division.name}"?</h3>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">{staffCount} staff member{staffCount === 1 ? '' : 's'} currently assigned</span>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Records keep their <code>division_id</code> tag but the business stream card disappears from the switcher and Enterprise Dashboard. Staff assigned here will become "unassigned" until reassigned via the Access Levels tab.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={doDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-60 transition">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Business Stream
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}