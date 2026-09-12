import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2, Edit2, Upload, FileText, AlertTriangle, X, CheckCircle2, Clock, FileWarning, Search } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { formatComplianceDate, complianceDaysUntil, parseComplianceDate } from '@/utils/complianceDate';
import ComplianceExpiryForecast from '@/components/compliance/ComplianceExpiryForecast';

const CATEGORIES = [
  { key: 'staff', label: 'Staff', color: 'bg-blue-100 text-blue-700' },
  { key: 'vehicle', label: 'Vehicle', color: 'bg-amber-100 text-amber-700' },
  { key: 'job', label: 'Job / Site', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'company', label: 'Company', color: 'bg-purple-100 text-purple-700' },
  { key: 'equipment', label: 'Equipment', color: 'bg-slate-100 text-slate-700' },
];

function getStatus(item) {
  if (item.status_override === 'not_required') return 'not_required';
  if (item.status_override === 'missing') return 'missing';
  if (!item.expiry_date) return 'compliant';
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return 'compliant';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'compliant';
}

const STATUS_CONFIG = {
  compliant: { label: 'Compliant', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  expiring_soon: { label: 'Expiring', icon: Clock, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  expired: { label: 'Expired', icon: AlertTriangle, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  missing: { label: 'Missing', icon: FileWarning, badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  not_required: { label: 'N/A', icon: CheckCircle2, badge: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300' },
};

const EMPTY_FORM = { category: 'staff', title: '', reference_name: '', reference_id: '', issue_date: '', expiry_date: '', responsible_person: '', notes: '', status_override: 'auto', document_url: '', document_name: '' };

export default function ComplianceTracking() {
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({ queryKey: ['compliance-items'], queryFn: () => base44.entities.ComplianceItem.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['compliance-items'] });

  const itemsWithStatus = useMemo(() => items.map(i => ({ ...i, _status: getStatus(i) })), [items]);

  const counts = useMemo(() => {
    const c = { compliant: 0, expiring_soon: 0, expired: 0, missing: 0 };
    itemsWithStatus.forEach(i => { if (c[i._status] !== undefined) c[i._status]++; });
    return c;
  }, [itemsWithStatus]);

  const filtered = useMemo(() => itemsWithStatus.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    if (filterStatus !== 'all' && i._status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (i.title || '').toLowerCase().includes(q) || (i.reference_name || '').toLowerCase().includes(q) || (i.responsible_person || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const order = { expired: 0, expiring_soon: 1, missing: 2, compliant: 3, not_required: 4 };
    if (order[a._status] !== order[b._status]) return order[a._status] - order[b._status];
    return (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999');
  }), [itemsWithStatus, filterCat, filterStatus, search]);

  const referenceOptions = useMemo(() => {
    if (form.category === 'staff') return staff.map(s => ({ id: s.id, label: s.name }));
    if (form.category === 'vehicle') return vehicles.map(v => ({ id: v.id, label: `${v.name} (${v.registration_number})` }));
    if (form.category === 'job') return jobs.map(j => ({ id: j.id, label: j.name }));
    return [];
  }, [form.category, staff, vehicles, jobs]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); };
  const openEdit = (item) => { setForm({ ...EMPTY_FORM, ...item }); setEditing(item); setShowForm(true); };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, document_url: res.file_url, document_name: file.name }));
    } catch (err) { console.error(err); alert('Upload failed: ' + (err.message || 'Unknown error')); }
    setUploading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category) return;
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload._status;
      if (editing) {
        await base44.entities.ComplianceItem.update(editing.id, payload);
      } else {
        await base44.entities.ComplianceItem.create(payload);
      }
      invalidate();
      setShowForm(false);
    } catch (err) { console.error(err); alert('Save failed: ' + (err.message || 'Unknown error')); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this compliance item?')) return;
    await base44.entities.ComplianceItem.delete(id);
    invalidate();
  };

  const setField = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === 'category') { next.reference_id = ''; next.reference_name = ''; }
    if (k === 'reference_id' && v) {
      const opt = referenceOptions.find(o => o.id === v);
      if (opt) next.reference_name = opt.label;
    }
    return next;
  });

  const stats = [
    { label: 'Compliant', value: counts.compliant, icon: CheckCircle2, gradient: 'stat-gradient-emerald' },
    { label: 'Expiring Soon', value: counts.expiring_soon, icon: Clock, gradient: 'stat-gradient-amber' },
    { label: 'Expired', value: counts.expired, icon: AlertTriangle, gradient: 'stat-gradient-rose' },
    { label: 'Missing', value: counts.missing, icon: FileWarning, gradient: 'stat-gradient-slate' },
  ];

  const statusFilters = [
    { id: 'all', label: 'All' },
    { id: 'expired', label: 'Expired' },
    { id: 'expiring_soon', label: 'Expiring' },
    { id: 'missing', label: 'Missing' },
    { id: 'compliant', label: 'Compliant' },
  ];

  return (
    <div>
      {/* Expiry velocity forecast */}
      <div className="mb-5">
        <ComplianceExpiryForecast items={items} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="hub-glass rounded-xl p-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-11 h-11 rounded-xl ${s.gradient} flex items-center justify-center shadow-md icon-tile-glow`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{s.value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + Add button */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 mb-5 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-600 capitalize">
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterStatus === f.id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 active:scale-95 transition flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">Loading compliance items…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No compliance items found</p>
            <p className="text-sm text-slate-400 mt-1">Add your first item to start tracking certifications, MOTs, insurance and more.</p>
            <button onClick={openAdd} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
              <Plus className="w-4 h-4" /> Add Compliance Item
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Item</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Reference</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Expires</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-left">Doc</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => {
                  const status = STATUS_CONFIG[item._status];
                  const cat = CATEGORIES.find(c => c.key === item.category);
                  const StatusIcon = status.icon;
                  const expDate = item.expiry_date ? parseComplianceDate(item.expiry_date) : null;
                  const daysLeft = item.expiry_date ? complianceDaysUntil(item.expiry_date) : null;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        {item.responsible_person && <p className="text-xs text-slate-400">Resp: {item.responsible_person}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat?.color || 'bg-slate-100 text-slate-500'}`}>{cat?.label || item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.reference_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3">
                        {expDate ? (
                          <div>
                            <p className={`font-medium ${item._status === 'expired' ? 'text-red-600' : item._status === 'expiring_soon' ? 'text-amber-600' : 'text-slate-600'}`}>
                              {item.expiry_date ? formatComplianceDate(item.expiry_date) : '—'}
                            </p>
                            {daysLeft !== null && item._status !== 'not_required' && (
                              <p className="text-xs text-slate-400">{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}</p>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>
                          <StatusIcon className="w-3 h-3" /> {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.document_url ? (
                          <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
                            <FileText className="w-3.5 h-3.5" /> View
                          </a>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !saving && !uploading && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" /> {editing ? 'Edit Item' : 'Add Compliance Item'}
              </h3>
              <button onClick={() => !saving && !uploading && setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                  <select value={form.category} onChange={e => setField('category', e.target.value)} required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={form.status_override} onChange={e => setField('status_override', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                    <option value="auto">Auto (from expiry date)</option>
                    <option value="missing">Missing / Not yet provided</option>
                    <option value="not_required">Not required</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} required placeholder="e.g. CPCS Card, Vehicle MOT, Public Liability Insurance"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
              {referenceOptions.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Linked {form.category}</label>
                  <select value={form.reference_id} onChange={e => setField('reference_id', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                    <option value="">— None —</option>
                    {referenceOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference name {referenceOptions.length === 0 && '(manual)'}</label>
                <input type="text" value={form.reference_name} onChange={e => setField('reference_name', e.target.value)} placeholder="e.g. John Smith, Van AB12 CDE"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Issue date</label>
                  <input type="date" value={form.issue_date || ''} onChange={e => setField('issue_date', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expiry date</label>
                  <input type="date" value={form.expiry_date || ''} onChange={e => setField('expiry_date', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsible person</label>
                <input type="text" value={form.responsible_person || ''} onChange={e => setField('responsible_person', e.target.value)} placeholder="Who manages this"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Document</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer transition flex-shrink-0">
                    <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                  </label>
                  {form.document_url && (
                    <span className="text-xs text-emerald-700 font-medium truncate flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> {form.document_name || 'Document attached'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes || ''} onChange={e => setField('notes', e.target.value)} rows={2} placeholder="Optional notes"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving || uploading || !form.title.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
                </button>
                <button type="button" onClick={() => !saving && !uploading && setShowForm(false)} disabled={saving || uploading}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}