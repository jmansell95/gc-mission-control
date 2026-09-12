import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import { X, Plus, Trash2, Edit2, Loader2, UserCog, Phone, Mail, CheckCircle2 } from 'lucide-react';

/**
 * AgencyWorkersModal — manages multiple individual agency workers under a
 * parent agency company. Each worker is a Staff record (worker_type='agency')
 * with crew_parent_id set to the parent agency Staff record.
 *
 * Unlike the CrewEditorModal (2-man pairings), each entry here is a single
 * person. Workers appear individually on the rota grid.
 */
export default function AgencyWorkersModal({ open, onClose, parentStaff, parentDivisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const divisionId = parentDivisionId || activeDivisionId || '';

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', job_title: '' });

  // Fetch individual worker Staff records linked to this parent agency
  const { data: workersData = [], refetch } = useQuery({
    queryKey: ['agency-workers', parentStaff?.id],
    queryFn: () => base44.entities.Staff.filter({ crew_parent_id: parentStaff?.id }, 'name', 200),
    enabled: !!parentStaff?.id,
  });

  useEffect(() => {
    setWorkers(workersData);
    setLoading(false);
  }, [workersData]);

  const resetForm = () => {
    setForm({ name: '', phone: '', email: '', job_title: '' });
    setEditingWorker(null);
    setShowAdd(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Worker name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const name = form.name.trim();
      const phone = form.phone.trim() || null;
      const email = form.email.trim() || null;
      const jobTitle = form.job_title.trim() || 'Agency Worker';

      if (editingWorker?.id) {
        await base44.entities.Staff.update(editingWorker.id, { name, phone, email, job_title: jobTitle });
        toast({ title: 'Worker updated' });
      } else {
        await base44.entities.Staff.create({
          name,
          worker_type: 'agency',
          company: parentStaff?.company || parentStaff?.name || '',
          crew_parent_id: parentStaff?.id,
          division_id: divisionId,
          phone,
          email,
          job_title: jobTitle,
          is_active: true,
        });
        toast({ title: 'Worker added' });
      }

      queryClient.invalidateQueries({ queryKey: ['agency-workers', parentStaff?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-staff', 'agency'] });
      resetForm();
    } catch (err) {
      toast({ title: 'Failed to save worker', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (worker) => {
    if (!confirm(`Delete worker "${worker.name}"?`)) return;
    setDeletingId(worker.id);
    try {
      await base44.entities.Staff.delete(worker.id);
      queryClient.invalidateQueries({ queryKey: ['agency-workers', parentStaff?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-staff', 'agency'] });
      toast({ title: 'Worker deleted' });
    } catch (err) {
      toast({ title: 'Failed to delete worker', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (worker) => {
    setEditingWorker(worker);
    setForm({
      name: worker.name || '',
      phone: worker.phone || '',
      email: worker.email || '',
      job_title: worker.job_title || '',
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Agency Workers</h3>
              <p className="text-xs text-slate-500">{parentStaff?.name || parentStaff?.company} — {workers.length} worker{workers.length !== 1 ? 's' : ''}</p>
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
          ) : workers.length === 0 && !showAdd ? (
            <div className="text-center py-8">
              <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-4">No workers yet. Add an individual worker to get started.</p>
              <button
                onClick={() => { setEditingWorker(null); setForm({ name: '', phone: '', email: '', job_title: '' }); setShowAdd(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Add First Worker
              </button>
            </div>
          ) : (
            <>
              {/* Worker list */}
              {workers.length > 0 && (
                <div className="space-y-2">
                  {workers.map(worker => (
                    <div key={worker.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{worker.name}</p>
                          {worker.job_title && <p className="text-xs text-slate-500 truncate">{worker.job_title}</p>}
                          <div className="mt-1 space-y-0.5">
                            {worker.phone && (
                              <p className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Phone className="w-3 h-3 flex-shrink-0" /> {worker.phone}
                              </p>
                            )}
                            {worker.email && (
                              <p className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" /> {worker.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(worker)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit worker">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(worker)} disabled={deletingId === worker.id} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50" title="Delete worker">
                            {deletingId === worker.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit form */}
              {showAdd ? (
                <form onSubmit={handleSave} className="rounded-lg border border-violet-200 bg-violet-50/30 p-4 space-y-3">
                  <p className="text-xs font-bold text-violet-800 uppercase tracking-wide">{editingWorker ? 'Edit Worker' : 'New Worker'}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Worker Name *</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Job Title</label>
                      <input type="text" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="Agency Worker" className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Phone</label>
                      <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {editingWorker ? 'Update Worker' : 'Add Worker'}
                    </button>
                    <button type="button" onClick={resetForm} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium">Cancel</button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => { setEditingWorker(null); setForm({ name: '', phone: '', email: '', job_title: '' }); setShowAdd(true); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-primary hover:text-primary transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Another Worker
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}