import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Edit2, Trash2, Mail, Phone, Search, Wrench,
  Upload, FileSpreadsheet, Loader2, RefreshCw, MapPin, Tag, Check
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';
import ContactsEditor from '@/components/ContactsEditor';
import { useConfigLists } from '@/hooks/useConfigLists';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blank = { name: '', category: '', contacts: [], notes: '', is_maintenance_provider: false, emergency_mobile: '', technical_email: '', portal_login_url: '', maintenance_services: [], account_number: '', lat: '', lng: '', geofence_radius_override: '' };

const CATEGORY_PILL_CLASSES = {
  training: 'bg-blue-100 text-blue-700',
  materials: 'bg-amber-100 text-amber-700',
  plant: 'bg-emerald-100 text-emerald-700',
  ppe: 'bg-violet-100 text-violet-700',
  fuel: 'bg-rose-100 text-rose-700',
  consumables: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-600',
};

const getCategoryPillClass = (category) => CATEGORY_PILL_CLASSES[(category || '').toLowerCase()] || 'bg-slate-100 text-slate-600';

const MAINT_SERVICE_OPTS = [
  { value: 'mot', label: 'MOT' },
  { value: 'service', label: 'Service' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'windscreen', label: 'Windscreen' },
  { value: 'tyre_repair', label: 'Tyre Repair' },
  { value: 'repair', label: 'General Repair' },
  { value: 'fuel_card', label: 'Fuel Card' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'risk_master', label: 'Risk Master' },
];

export default function SupplierManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [ingestingId, setIngestingId] = useState(null);
  const fileRef = useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState(null);

  const { activeDivisionId } = useDivision();
  const { data: suppliers = [] } = useScopedEntity('Supplier', { queryKey: ['suppliers'] });
  const { getOptions, invalidate: invalidateConfigLists } = useConfigLists();
  const categoryOptions = getOptions('supplier_categories');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const filtered = suppliers.filter(s => {
    if (categoryFilter !== 'all' && (s.category || '') !== categoryFilter) return false;
    return s.name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleAddCategoryInline = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const value = name.toLowerCase().replace(/\s+/g, '_');
      const existing = await base44.entities.ConfigList.filter({ key: 'supplier_categories' });
      if (existing.length > 0) {
        const rec = existing[0];
        const options = [...(rec.options || []), { value, label: name }];
        await base44.entities.ConfigList.update(rec.id, { options });
      } else {
        await base44.entities.ConfigList.create({
          key: 'supplier_categories',
          label: 'Supplier Categories',
          category: 'Suppliers',
          is_system: true,
          options: [{ value, label: name }],
        });
      }
      invalidateConfigLists();
      setForm(prev => ({ ...prev, category: value }));
      setNewCategoryName('');
      setAddingCategory(false);
      toast({ title: 'Category added', description: name });
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not add category', variant: 'destructive' });
    }
    setSavingCategory(false);
  };

  const startAdd = () => { setForm(blank); setEditingId(null); setAdding(true); };
  const startEdit = (s) => {
    setForm({
      name: s.name, category: s.category || '', contacts: s.contacts || [], notes: s.notes || '',
      is_maintenance_provider: s.is_maintenance_provider || false, emergency_mobile: s.emergency_mobile || '',
      technical_email: s.technical_email || '', portal_login_url: s.portal_login_url || '',
      maintenance_services: s.maintenance_services || [], account_number: s.account_number || '',
      lat: s.lat ?? '', lng: s.lng ?? '', geofence_radius_override: s.geofence_radius_override ?? '',
    });
    setEditingId(s.id); setAdding(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.Supplier.update(editingId, form);
      } else {
        await base44.entities.Supplier.create({ ...form, division_id: activeDivisionId });
      }
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Supplier'] });
      setAdding(false); setEditingId(null); setForm(blank);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this supplier? Their ingested rate card items will also be removed.')) return;
    try {
      await base44.entities.RateCardItem.deleteMany({ rate_card_source: 'supplier', supplier_id: id });
    } catch (e) { console.error(e); }
    await base44.entities.Supplier.delete(id);
    queryClient.invalidateQueries({ queryKey: ['scoped', 'Supplier'] });
    queryClient.invalidateQueries({ queryKey: ['scoped', 'RateCardItem'] });
  };

  const handleUploadClick = (supplierId) => {
    setUploadTargetId(supplierId);
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    setIngestingId(uploadTargetId);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Supplier.update(uploadTargetId, {
        rate_card_file_url: uploadRes.file_url,
        rate_card_file_name: file.name
      });
      const res = await base44.functions.invoke('processRateCardUpload', {
        supplier_id: uploadTargetId,
        file_url: uploadRes.file_url
      });
      const data = res.data || res;
      if (data && data.status === 'success') {
        toast({ title: `Ingested ${data.ingested} rate card items`, description: file.name });
      } else {
        toast({ title: 'Ingest failed', description: data?.error || 'Could not read the rate card file', variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Supplier'] });
      queryClient.invalidateQueries({ queryKey: ['scoped', 'RateCardItem'] });
    } catch (err) {
      console.error(err);
      toast({ title: 'Ingest failed', description: err.message, variant: 'destructive' });
    }
    setIngestingId(null);
    setUploadTargetId(null);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Package}
        title="Suppliers"
        description="Upload each supplier's rate card (Excel, CSV or PDF) to auto-ingest it into the Master Price List."
        actions={
          <button onClick={startAdd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        }
      />

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFilePicked} />

      <Dialog open={adding} onOpenChange={(open) => { if (!open) { setAdding(false); setEditingId(null); setForm(blank); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Supplier' : 'New Supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Category
              </label>
              {!addingCategory ? (
                <div className="flex gap-2">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls + ' flex-1'}>
                    <option value="">— Uncategorised —</option>
                    {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setAddingCategory(true)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className={inputCls + ' flex-1'} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategoryInline(); } }} />
                  <button type="button" onClick={handleAddCategoryInline} disabled={savingCategory || !newCategoryName.trim()} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1">
                    {savingCategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                  </button>
                  <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName(''); }} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">Cancel</button>
                </div>
              )}
            </div>
            <ContactsEditor
              value={form.contacts}
              onChange={(contacts) => setForm((prev) => ({ ...prev, contacts }))}
              label="Additional Contacts"
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" className={inputCls} />
            </div>

            {/* Geofence Location — for vehicle arrival/departure detection at supplier yards */}
            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" /> Yard / Depot Location
                <span className="text-xs text-slate-400 font-normal">(for Geotab geofence arrival/departure detection)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="Latitude (e.g. 51.5074)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="Longitude (e.g. -0.1278)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <SupplierGeocodeButton
                  address={form.name}
                  onResult={(lat, lng) => setForm(prev => ({ ...prev, lat, lng }))}
                />
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Geofence Radius Override (metres) — blank = global default</label>
                <input type="number" min="0" step="1" value={form.geofence_radius_override} onChange={(e) => setForm({ ...form, geofence_radius_override: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="e.g. 250" className={inputCls + ' max-w-[200px]'} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Set the supplier's yard/depot GPS coordinates so Geotab can detect when vehicles arrive to collect or return gear. Override the radius for large yards.</p>
            </div>

            {/* Maintenance provider section */}
            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3 cursor-pointer">
                <input type="checkbox" checked={form.is_maintenance_provider} onChange={(e) => setForm({ ...form, is_maintenance_provider: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Maintenance Provider
                <span className="text-xs text-slate-400 font-normal">(Show in Maintenance Hub & booking dropdown)</span>
              </label>
              {form.is_maintenance_provider && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Emergency Mobile (24/7)</label>
                    <input value={form.emergency_mobile} onChange={(e) => setForm({ ...form, emergency_mobile: e.target.value })} placeholder="e.g. 07xxx xxx xxx" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Technical / Alerts Email</label>
                    <input type="email" value={form.technical_email} onChange={(e) => setForm({ ...form, technical_email: e.target.value })} placeholder="e.g. service@holman.co.uk" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Portal Login URL</label>
                    <input value={form.portal_login_url} onChange={(e) => setForm({ ...form, portal_login_url: e.target.value })} placeholder="https://..." className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Number</label>
                    <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Services Offered</label>
                    <div className="flex flex-wrap gap-1.5">
                      {MAINT_SERVICE_OPTS.map(opt => {
                        const active = form.maintenance_services.includes(opt.value);
                        return (
                          <button key={opt.value} type="button" onClick={() => {
                            const next = active
                              ? form.maintenance_services.filter(v => v !== opt.value)
                              : [...form.maintenance_services, opt.value];
                            setForm({ ...form, maintenance_services: next });
                          }} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">{editingId ? 'Update' : 'Add'} Supplier</button>
            <button type="button" onClick={() => { setAdding(false); setEditingId(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
          </div>
        </form>
        </DialogContent>
      </Dialog>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white" />
      </div>
      {categoryOptions.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${categoryFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>All</button>
          {categoryOptions.map(opt => (
            <button key={opt.value} onClick={() => setCategoryFilter(opt.value)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${categoryFilter === opt.value ? getCategoryPillClass(opt.value) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No suppliers yet. Add your first hire supplier and upload their rate card to auto-populate job costing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{s.name}</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryPillClass(s.category)}`}>
                      {categoryOptions.find(o => o.value === s.category)?.label || (s.category ? s.category : 'Uncategorised')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => remove(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-500 mb-3">
                {s.contact_email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {s.contact_email}</div>}
                {s.contact_phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {s.contact_phone}</div>}
                {s.is_maintenance_provider && (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Wrench className="w-3.5 h-3.5" /> Maintenance Provider
                    {s.maintenance_services?.length > 0 && <span className="text-slate-400 font-normal">· {s.maintenance_services.length} services</span>}
                  </div>
                )}
                {s.lat != null && s.lng != null && (
                  <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <MapPin className="w-3.5 h-3.5" /> Geofence active
                    {s.geofence_radius_override && <span className="text-slate-400 font-normal">· {s.geofence_radius_override}m radius</span>}
                  </div>
                )}
              </div>

              {/* Rate card section */}
              <div className="border-t border-slate-100 pt-3">
                {s.rate_card_file_url ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-700 truncate">{s.rate_card_file_name || 'Rate card file'}</p>
                        <p className="text-slate-400">
                          {s.rate_card_item_count ? `${s.rate_card_item_count} items ingested` : 'Not yet ingested'}
                          {s.rate_card_synced_at && ` · ${format(new Date(s.rate_card_synced_at), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUploadClick(s.id)}
                      disabled={ingestingId === s.id}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition border border-emerald-200 disabled:opacity-50">
                      {ingestingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {ingestingId === s.id ? 'Re-ingesting…' : 'Re-upload & re-ingest'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleUploadClick(s.id)}
                    disabled={ingestingId === s.id}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-200 text-slate-500 rounded-lg text-xs font-semibold hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition disabled:opacity-50">
                    {ingestingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {ingestingId === s.id ? 'Ingesting…' : 'Upload rate card'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierGeocodeButton({ address, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeocode = async () => {
    if (!address?.trim()) { setError('Enter a supplier name first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Return the GPS latitude and longitude of this UK supplier/yard location as a JSON object: "${address}". Use only valid numeric coordinates. If the name is ambiguous, return the most likely match for the UK.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        }
      });
      if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
        onResult(res.lat, res.lng);
      } else {
        setError('Could not geocode this location');
      }
    } catch (e) {
      setError(e.message || 'Geocode failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={handleGeocode} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition disabled:opacity-60 flex-shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        Auto-fill
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}