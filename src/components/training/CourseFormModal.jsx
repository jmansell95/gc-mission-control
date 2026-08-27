import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { X, GraduationCap, Loader2, Building2, Info } from 'lucide-react';
import { format } from 'date-fns';

const emptyCourse = {
  title: '', category: '', provider_id: '', provider: '', provider_phone: '',
  venue: '', address: '', start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'), start_time: '08:00', end_time: '16:00',
  description: '', default_expiry_months: '', status: 'scheduled',
};

/**
 * CourseFormModal — popup modal for creating or editing a training course.
 * Replaces the old inline form in TrainingManager. The Category dropdown is
 * sourced from the managed TrainingRequirement categories, and the Provider
 * dropdown is smart-linked: it only shows training providers whose
 * training_services include the selected category (falls back to all
 * providers when no category is chosen). Selecting a provider writes its
 * name + phone onto the course for backward compatibility.
 */
export default function CourseFormModal({ editing, onClose, onSaved }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => editing
    ? { ...emptyCourse, ...editing, default_expiry_months: editing.default_expiry_months || '' }
    : emptyCourse);
  const [saving, setSaving] = useState(false);

  const { data: requirements = [] } = useQuery({ queryKey: ['training-requirements'], queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100) });
  const { data: providers = [] } = useQuery({ queryKey: ['training-providers'], queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }) });

  const categories = useMemo(() =>
    requirements.filter(r => r.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [requirements]);

  const filteredProviders = useMemo(() => {
    if (!form.category) return providers;
    return providers.filter(p => p.training_services?.includes(form.category));
  }, [providers, form.category]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCategoryChange = (val) => {
    setForm(prev => {
      const matching = val ? providers.filter(p => p.training_services?.includes(val)) : providers;
      const providerStillValid = matching.some(p => p.id === prev.provider_id);
      return { ...prev, category: val, provider_id: providerStillValid ? prev.provider_id : '' };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: 'Course title is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const provider = providers.find(p => p.id === form.provider_id);
      const payload = {
        ...form,
        provider: provider?.name || form.provider || '',
        provider_phone: provider?.contacts?.[0]?.phone || provider?.contact_phone || form.provider_phone || '',
        default_expiry_months: form.default_expiry_months ? parseInt(form.default_expiry_months) : null,
      };
      if (editing) {
        await base44.entities.TrainingCourse.update(editing.id, payload);
        toast({ title: 'Course updated' });
      } else {
        await base44.entities.TrainingCourse.create(payload);
        toast({ title: 'Course created' });
      }
      queryClient.invalidateQueries({ queryKey: ['training-courses'] });
      onSaved?.();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 bg-white';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base">{editing ? 'Edit Course' : 'New Training Course'}</h3>
              <p className="text-xs text-white/70 truncate">Category + provider are linked automatically</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Course Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Forklift Operator Training" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => handleCategoryChange(e.target.value)} className={inputCls}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.qualification_type}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cert Validity (months)</label>
              <input type="number" value={form.default_expiry_months} onChange={e => set('default_expiry_months', e.target.value)} placeholder="e.g. 36" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Provider</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select value={form.provider_id} onChange={e => set('provider_id', e.target.value)} className={inputCls + ' pl-9'}>
                <option value="">{form.category ? 'No matching provider' : 'Select provider…'}</option>
                {filteredProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {form.category && filteredProviders.length === 0 && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5">
                <Info className="w-3 h-3" /> No providers offer this category yet — add one in the Providers tab.
              </p>
            )}
            {form.category && filteredProviders.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5">Showing {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} matching this category.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Venue Name</label>
              <input value={form.venue} onChange={e => set('venue', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Venue Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Daily Start Time</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Daily End Time</label>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description / Notes</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inputCls + ' resize-none'} />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              {saving ? 'Saving…' : editing ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}