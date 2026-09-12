import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Phone, Mail, Award, Plus, X, Edit2, Trash2, Search, ShieldCheck, Loader2, Sparkles, Settings,
} from 'lucide-react';
import { ViewHeader, PRIMARY_BTN, SECONDARY_BTN } from '@/components/training/TrainingHubRail';

const TRAINING_SERVICES = [
  { value: 'cscs_card', label: 'CSCS Card' },
  { value: 'cpcs_card', label: 'CPCS Card' },
  { value: 'npors_card', label: 'NPORS Card' },
  { value: 'first_aid_cert', label: 'First Aid' },
  { value: 'driver_license', label: 'Driver Licence' },
  { value: 'dbs_certificate', label: 'DBS' },
  { value: 'forklift', label: 'Forklift' },
  { value: 'confined_space', label: 'Confined Space' },
  { value: 'asbestos_awareness', label: 'Asbestos Awareness' },
  { value: 'manual_handling', label: 'Manual Handling' },
  { value: 'working_at_height', label: 'Working at Height' },
  { value: 'sts_triple', label: 'STS Triple' },
  { value: 'nvq', label: 'NVQ' },
  { value: 'ipaf', label: 'IPAF' },
  { value: 'pasma', label: 'PASMA' },
  { value: 'traffic_management', label: 'Traffic Management' },
  { value: 'plant_training', label: 'Plant Training' },
  { value: 'other', label: 'Other' },
];

const ACCREDITATIONS = [
  { value: 'citb', label: 'CITB' },
  { value: 'npors_approved', label: 'NPORS Approved' },
  { value: 'cscs_approved', label: 'CSCS Approved' },
  { value: 'chas', label: 'CHAS' },
  { value: 'constructionline', label: 'Constructionline' },
  { value: 'iso9001', label: 'ISO 9001' },
  { value: 'iso45001', label: 'ISO 45001' },
  { value: 'other', label: 'Other' },
];

/**
 * TrainingProvidersTab — manages the list of training providers (Suppliers
 * flagged is_training_provider = true). Shows company name, phone, email,
 * what they provide, and accreditations. Add/edit/delete inline.
 */
export default function TrainingProvidersTab({ onBulkImport, onManage }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['training-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? suppliers.filter(s => (s.name || '').toLowerCase().includes(q)) : suppliers;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [suppliers, search]);

  const handleDelete = async (s) => {
    if (!confirm(`Remove ${s.name} from training providers? (The supplier record is kept, just unflagged.)`)) return;
    try {
      await base44.entities.Supplier.update(s.id, { is_training_provider: false, training_services: [] });
      queryClient.invalidateQueries({ queryKey: ['training-providers'] });
      toast({ title: 'Provider removed' });
    } catch (e) {
      toast({ title: 'Could not remove', description: e.message, variant: 'destructive' });
    }
  };

  const serviceLabel = (v) => TRAINING_SERVICES.find(s => s.value === v)?.label || v;
  const accredLabel = (v) => ACCREDITATIONS.find(a => a.value === v)?.label || v;

  const primaryContact = (s) => s.contacts?.[0] || null;

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <ViewHeader icon={Building2} title="Training Providers" subtitle={`${filtered.length} provider${filtered.length !== 1 ? 's' : ''} · what they deliver drives course linking`}>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className={PRIMARY_BTN} type="button"><Plus className="w-4 h-4" /> Add Provider</button>
        <button onClick={onBulkImport} className={SECONDARY_BTN} type="button"><Sparkles className="w-4 h-4" /> Bulk Import</button>
        <button onClick={onManage} className={SECONDARY_BTN} type="button"><Settings className="w-4 h-4" /> Categories</button>
      </ViewHeader>
      <div className="relative max-w-sm mb-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search providers…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
      </div>

      {/* Provider cards */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center bg-white/40">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No training providers yet. Add one to link courses and record completed training.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(s => {
            const c = primaryContact(s);
            return (
              <div key={s.id} className="hub-glass rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                    {c?.role && <p className="text-[11px] text-slate-400 truncate">{c.role}</p>}
                  </div>
                  <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 rounded-lg transition flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Contact details */}
                <div className="space-y-1 mb-3">
                  {c?.phone && <p className="text-xs text-slate-600 flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {c.phone}</p>}
                  {c?.email && <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 text-slate-400" /> {c.email}</p>}
                  {!c && (s.contact_phone || s.contact_email) && (
                    <>
                      {s.contact_phone && <p className="text-xs text-slate-600 flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {s.contact_phone}</p>}
                      {s.contact_email && <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 text-slate-400" /> {s.contact_email}</p>}
                    </>
                  )}
                </div>

                {/* What they provide */}
                {s.training_services?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Provides</p>
                    <div className="flex flex-wrap gap-1">
                      {s.training_services.slice(0, 5).map(v => (
                        <span key={v} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A]">{serviceLabel(v)}</span>
                      ))}
                      {s.training_services.length > 5 && <span className="text-[10px] text-slate-400">+{s.training_services.length - 5}</span>}
                    </div>
                  </div>
                )}

                {/* Accreditations */}
                {s.accreditations?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Accreditations</p>
                    <div className="flex flex-wrap gap-1">
                      {s.accreditations.map(v => (
                        <span key={v} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          <ShieldCheck className="w-2.5 h-2.5" /> {accredLabel(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <ProviderFormModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['training-providers'] }); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

/**
 * ProviderFormModal — add a new training provider (either a new Supplier or
 * flag an existing one) or edit an existing provider's training fields.
 */
function ProviderFormModal({ editing, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: editing?.name || '',
    contact_name: editing?.contacts?.[0]?.name || editing?.contact_name || '',
    contact_phone: editing?.contacts?.[0]?.phone || editing?.contact_phone || '',
    contact_email: editing?.contacts?.[0]?.email || editing?.contact_email || '',
    training_services: editing?.training_services || [],
    accreditations: editing?.accreditations || [],
    notes: editing?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [customPill, setCustomPill] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleArr = (k, v) => setForm(prev => ({ ...prev, [k]: prev[k].includes(v) ? prev[k].filter(x => x !== v) : [...prev[k], v] }));

  // Values in training_services that aren't in the standard list (custom pills).
  const standardValues = new Set(TRAINING_SERVICES.map(s => s.value));
  const customServices = form.training_services.filter(v => !standardValues.has(v));

  const addCustomPill = () => {
    const val = customPill.trim();
    if (!val) return;
    // Use lowercase snake_case for consistency with standard values.
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug || form.training_services.includes(slug)) { setCustomPill(''); return; }
    setForm(prev => ({ ...prev, training_services: [...prev.training_services, slug] }));
    setCustomPill('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'Company name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const contacts = form.contact_name ? [{ name: form.contact_name, phone: form.contact_phone, email: form.contact_email }] : [];
      const payload = {
        name: form.name,
        is_training_provider: true,
        training_services: form.training_services,
        accreditations: form.accreditations,
        notes: form.notes,
        contacts,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
      };
      if (editing) {
        await base44.entities.Supplier.update(editing.id, payload);
        toast({ title: 'Provider updated' });
      } else {
        await base44.entities.Supplier.create(payload);
        toast({ title: 'Training provider added' });
      }
      onSaved();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';
  const chipCls = (active) => 'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition ' +
    (active ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 p-5 pb-3 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{editing ? 'Edit Provider' : 'Add Training Provider'}</h3>
              <p className="text-xs text-slate-500">Company details + what they deliver</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 pt-3 space-y-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="e.g. CITB Training" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>What They Provide</label>
            <div className="flex flex-wrap gap-1.5">
              {TRAINING_SERVICES.map(s => (
                <button key={s.value} type="button" onClick={() => toggleArr('training_services', s.value)} className={chipCls(form.training_services.includes(s.value))}>
                  {s.label}
                </button>
              ))}
            </div>
            {/* Custom pills added per-provider (not in the standard list) */}
            {customServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customServices.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#2E5A1A]/10 text-[#2E5A1A]">
                    {v.replace(/_/g, ' ')}
                    <button type="button" onClick={() => toggleArr('training_services', v)} className="hover:bg-[#2E5A1A]/20 rounded p-0.5 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Add a custom pill */}
            <div className="flex gap-1.5 mt-2">
              <input
                value={customPill}
                onChange={e => setCustomPill(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomPill(); } }}
                placeholder="Add custom training type…"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
              />
              <button type="button" onClick={addCustomPill} disabled={!customPill.trim()}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#2E5A1A] hover:bg-[#1c4a12] disabled:opacity-40 transition">
                Add
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Accreditations</label>
            <div className="flex flex-wrap gap-1.5">
              {ACCREDITATIONS.map(a => (
                <button key={a.value} type="button" onClick={() => toggleArr('accreditations', a.value)} className={chipCls(form.accreditations.includes(a.value))}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputCls + ' resize-none'} />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              {saving ? 'Saving…' : editing ? 'Update Provider' : 'Add Provider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}