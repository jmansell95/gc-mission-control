import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import { X, Plus, Trash2, Edit2, Loader2, HardHat, Phone, CheckCircle2 } from 'lucide-react';

/**
 * CrewEditorModal — manages multiple 2-man drilling crews (Lead Driller +
 * Second Man) for a subcontractor. Each crew is a DrillingCrew grouping that
 * links two individual Staff records (worker_type=subcontractor with
 * crew_parent_id set to the parent subcontractor).
 *
 * The crew pairings appear as sub-lines on the rota grid and job detail page.
 */
export default function CrewEditorModal({ open, onClose, parentStaff, parentDivisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const divisionId = parentDivisionId || activeDivisionId || '';

  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCrew, setEditingCrew] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ lead_name: '', lead_phone: '', second_name: '', second_phone: '' });

  // Fetch all DrillingCrew groupings for this parent subcontractor
  const { data: allCrews = [], refetch } = useQuery({
    queryKey: ['drilling-crews', parentStaff?.id],
    queryFn: () => base44.entities.DrillingCrew.filter({ parent_staff_id: parentStaff?.id }, 'name', 200),
    enabled: !!parentStaff?.id,
  });

  // Fetch the individual driller Staff records linked to this parent
  const { data: drillers = [] } = useQuery({
    queryKey: ['crew-drillers', parentStaff?.id],
    queryFn: () => base44.entities.Staff.filter({ crew_parent_id: parentStaff?.id }, 'name', 200),
    enabled: !!parentStaff?.id,
  });

  useEffect(() => {
    if (allCrews.length > 0 && drillers.length > 0) {
      const drillerMap = new Map(drillers.map(d => [d.id, d]));
      const enriched = allCrews.map(c => ({
        ...c,
        lead_driller: c.lead_driller_staff_id ? drillerMap.get(c.lead_driller_staff_id) : null,
        second_man: c.second_man_staff_id ? drillerMap.get(c.second_man_staff_id) : null,
      }));
      setCrews(enriched);
    } else {
      setCrews([]);
    }
    setLoading(false);
  }, [allCrews, drillers]);

  const resetForm = () => {
    setForm({ lead_name: '', lead_phone: '', second_name: '', second_phone: '' });
    setEditingCrew(null);
    setShowAdd(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.lead_name.trim()) {
      toast({ title: 'Lead Driller name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const leadName = form.lead_name.trim();
      const secondName = form.second_name.trim() || null;
      const leadPhone = form.lead_phone.trim() || null;
      const secondPhone = form.second_phone.trim() || null;

      // Find or create the Lead Driller Staff record
      let leadStaffId = null;
      if (editingCrew?.lead_driller_staff_id) {
        // Update existing
        await base44.entities.Staff.update(editingCrew.lead_driller_staff_id, {
          name: leadName, phone: leadPhone,
        });
        leadStaffId = editingCrew.lead_driller_staff_id;
      } else {
        // Check if a driller with this name already exists under this parent
        const existing = drillers.find(d => d.name?.toLowerCase() === leadName.toLowerCase());
        if (existing) {
          await base44.entities.Staff.update(existing.id, { name: leadName, phone: leadPhone });
          leadStaffId = existing.id;
        } else {
          const created = await base44.entities.Staff.create({
            name: leadName,
            worker_type: 'subcontractor',
            company: parentStaff?.company || parentStaff?.name || '',
            crew_parent_id: parentStaff?.id,
            division_id: divisionId,
            phone: leadPhone,
            is_active: true,
            job_title: 'Lead Driller',
          });
          leadStaffId = created.id;
        }
      }

      // Find or create the Second Man Staff record
      let secondStaffId = null;
      if (secondName) {
        if (editingCrew?.second_man_staff_id) {
          await base44.entities.Staff.update(editingCrew.second_man_staff_id, {
            name: secondName, phone: secondPhone,
          });
          secondStaffId = editingCrew.second_man_staff_id;
        } else {
          const existing = drillers.find(d => d.name?.toLowerCase() === secondName.toLowerCase());
          if (existing) {
            await base44.entities.Staff.update(existing.id, { name: secondName, phone: secondPhone });
            secondStaffId = existing.id;
          } else {
            const created = await base44.entities.Staff.create({
              name: secondName,
              worker_type: 'subcontractor',
              company: parentStaff?.company || parentStaff?.name || '',
              crew_parent_id: parentStaff?.id,
              division_id: divisionId,
              phone: secondPhone,
              is_active: true,
              job_title: 'Second Man Driller',
            });
            secondStaffId = created.id;
          }
        }
      }

      // Create or update the DrillingCrew grouping
      const crewName = `${leadName}${secondName ? ` + ${secondName}` : ''}`;
      const crewPayload = {
        name: crewName,
        lead_driller_staff_id: leadStaffId,
        second_man_staff_id: secondStaffId,
        parent_staff_id: parentStaff?.id,
        division_id: divisionId,
        is_active: true,
        lead_driller_name: leadName,
        lead_driller_phone: leadPhone,
        second_man_name: secondName || '',
        second_man_phone: secondPhone || '',
      };

      if (editingCrew?.id) {
        await base44.entities.DrillingCrew.update(editingCrew.id, crewPayload);
        toast({ title: 'Crew updated' });
      } else {
        await base44.entities.DrillingCrew.create(crewPayload);
        toast({ title: 'Crew added' });
      }

      queryClient.invalidateQueries({ queryKey: ['drilling-crews', parentStaff?.id] });
      queryClient.invalidateQueries({ queryKey: ['crew-drillers', parentStaff?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-staff', 'subcontractor'] });
      resetForm();
    } catch (err) {
      toast({ title: 'Failed to save crew', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (crew) => {
    if (!confirm(`Delete crew "${crew.name}"? The individual driller records will be kept but unlinked.`)) return;
    setDeletingId(crew.id);
    try {
      await base44.entities.DrillingCrew.delete(crew.id);
      queryClient.invalidateQueries({ queryKey: ['drilling-crews', parentStaff?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Crew deleted' });
    } catch (err) {
      toast({ title: 'Failed to delete crew', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (crew) => {
    setEditingCrew(crew);
    setForm({
      lead_name: crew.lead_driller_name || crew.lead_driller?.name || '',
      lead_phone: crew.lead_driller_phone || crew.lead_driller?.phone || '',
      second_name: crew.second_man_name || crew.second_man?.name || '',
      second_phone: crew.second_man_phone || crew.second_man?.phone || '',
    });
    setShowAdd(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Drilling Crews</h3>
              <p className="text-xs text-slate-500">{parentStaff?.name || parentStaff?.company} — {crews.length} crew{crews.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : crews.length === 0 && !showAdd ? (
            <div className="text-center py-8">
              <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-4">No crews yet. Add a 2-man crew to get started.</p>
              <button
                onClick={() => { setEditingCrew(null); setForm({ lead_name: '', lead_phone: '', second_name: '', second_phone: '' }); setShowAdd(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Add First Crew
              </button>
            </div>
          ) : (
            <>
              {/* Crew list */}
              {crews.length > 0 && (
                <div className="space-y-2">
                  {crews.map(crew => (
                    <div key={crew.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{crew.name}</p>
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex-shrink-0">L</span>
                              <span className="font-medium truncate">{crew.lead_driller_name || crew.lead_driller?.name || '—'}</span>
                              {(crew.lead_driller_phone || crew.lead_driller?.phone) && (
                                <span className="text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                                  <Phone className="w-2.5 h-2.5" /> {crew.lead_driller_phone || crew.lead_driller?.phone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex-shrink-0">S</span>
                              <span className="font-medium truncate">{crew.second_man_name || crew.second_man?.name || '—'}</span>
                              {(crew.second_man_phone || crew.second_man?.phone) && (
                                <span className="text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                                  <Phone className="w-2.5 h-2.5" /> {crew.second_man_phone || crew.second_man?.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(crew)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit crew">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(crew)} disabled={deletingId === crew.id} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50" title="Delete crew">
                            {deletingId === crew.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit form */}
              {showAdd ? (
                <form onSubmit={handleSave} className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">{editingCrew ? 'Edit Crew' : 'New 2-Man Crew'}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Lead Driller Name *</label>
                      <input type="text" value={form.lead_name} onChange={e => setForm({ ...form, lead_name: e.target.value })} autoFocus className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Lead Driller Phone</label>
                      <input type="text" value={form.lead_phone} onChange={e => setForm({ ...form, lead_phone: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Second Man Name</label>
                      <input type="text" value={form.second_name} onChange={e => setForm({ ...form, second_name: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Second Man Phone</label>
                      <input type="text" value={form.second_phone} onChange={e => setForm({ ...form, second_phone: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {editingCrew ? 'Update Crew' : 'Add Crew'}
                    </button>
                    <button type="button" onClick={resetForm} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium">Cancel</button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => { setEditingCrew(null); setForm({ lead_name: '', lead_phone: '', second_name: '', second_phone: '' }); setShowAdd(true); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-primary hover:text-primary transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Another Crew
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}