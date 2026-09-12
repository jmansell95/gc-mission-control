import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Pencil, Check, X, Loader2, Upload, HardHat,
  FileSpreadsheet, PoundSterling, Drill, Layers
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => n != null ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const SHEET_META = {
  'CP Standard': { label: 'CP Standard', icon: HardHat, color: 'text-emerald-700 bg-emerald-50' },
  'CP Cutdown': { label: 'CP Cutdown', icon: HardHat, color: 'text-teal-700 bg-teal-50' },
  'Rotary Drilling & Coring': { label: 'Rotary Drilling & Coring', icon: Drill, color: 'text-blue-700 bg-blue-50' },
  'Sonic Drilling & Coring': { label: 'Sonic Drilling & Coring', icon: Drill, color: 'text-violet-700 bg-violet-50' },
  'Dynamic Sampling': { label: 'Dynamic Sampling', icon: Layers, color: 'text-amber-700 bg-amber-50' },
};

const SHEET_ORDER = ['CP Standard', 'CP Cutdown', 'Rotary Drilling & Coring', 'Sonic Drilling & Coring', 'Dynamic Sampling'];

const inputCls = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600';

function SORItemRow({ item, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    description: item.description || '',
    item_ref: item.item_ref || '',
    unit: item.unit || '',
    price: item.price ?? '',
    price_text: item.price_text ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.InvestigationSOR.update(item.id, {
        description: form.description,
        item_ref: form.item_ref || null,
        unit: form.unit || null,
        price: form.price === '' ? null : Number(form.price),
        price_text: form.price_text || null,
      });
      onUpdate();
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const priceDisplay = item.price != null ? fmt(item.price) : item.price_text || '—';

  if (editing) {
    return (
      <div className="p-3 bg-slate-50 space-y-2 border-b border-slate-100">
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 font-medium">Item Ref</label>
            <input value={form.item_ref} onChange={e => setForm({ ...form, item_ref: e.target.value })} className={inputCls} placeholder="2.1" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-medium">Unit</label>
            <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="m, sum, nr" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-medium">Price (£)</label>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-medium">Price text</label>
            <input value={form.price_text} onChange={e => setForm({ ...form, price_text: e.target.value })} className={inputCls} placeholder="POA" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
          </button>
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition group border-b border-slate-100 last:border-0">
      {item.item_ref && <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 w-8 pt-0.5">{item.item_ref}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{item.description}</p>
      </div>
      {item.unit && <span className="text-xs text-slate-400 flex-shrink-0 pt-0.5">/{item.unit}</span>}
      <div className="text-right flex-shrink-0 min-w-[80px]">
        <span className={`text-sm font-semibold tabular-nums block ${item.price != null ? 'text-slate-900' : 'text-slate-400 italic'}`}>{priceDisplay}</span>
      </div>
      <button onClick={() => { setForm({ description: item.description || '', item_ref: item.item_ref || '', unit: item.unit || '', price: item.price ?? '', price_text: item.price_text ?? '' }); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-700 transition flex-shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddSORForm({ sheetName, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', item_ref: '', unit: 'm', price: '', price_text: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.InvestigationSOR.create({
        sheet_name: sheetName,
        description: form.description.trim(),
        item_ref: form.item_ref || null,
        unit: form.unit || null,
        price: form.price === '' ? null : Number(form.price),
        price_text: form.price_text || null,
        year: 2026,
      });
      setForm({ description: '', item_ref: '', unit: 'm', price: '', price_text: '' });
      setOpen(false);
      onAdded();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-lg transition border border-dashed border-slate-200">
        <Plus className="w-3.5 h-3.5" /> Add rate
      </button>
    );
  }

  return (
    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
      <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} autoFocus />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input value={form.item_ref} onChange={e => setForm({ ...form, item_ref: e.target.value })} placeholder="Item ref" className={inputCls} />
        <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Unit" className={inputCls} />
        <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price £" className={inputCls} />
        <input value={form.price_text} onChange={e => setForm({ ...form, price_text: e.target.value })} placeholder="Price text (POA)" className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
        </button>
        <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function SORRateCardManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSheet, setActiveSheet] = useState('CP Standard');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sor-items'],
    queryFn: () => base44.entities.InvestigationSOR.list('-created_date', 500),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sor-items'] });

  const counts = useMemo(() => {
    const c = {};
    for (const s of SHEET_ORDER) c[s] = 0;
    for (const i of items) {
      if (c[i.sheet_name] != null) c[i.sheet_name]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.filter(i => i.sheet_name === activeSheet);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.item_ref || '').toLowerCase().includes(q) ||
        (i.section_heading || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [items, activeSheet, query]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const key = i.section_heading || (i.section ? `Section ${i.section}` : 'General');
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return Object.entries(map);
  }, [filtered]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = uploadRes.file_url;
      const res = await base44.functions.invoke('processSORUpload', { file_url: fileUrl, year: 2026 });
      toast({
        title: 'SOR ingested',
        description: `${res.data.ingested} rates loaded for ${res.data.year} across ${Object.keys(res.data.per_sheet || {}).length} sheets.`,
      });
      refresh();
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not process SOR file', variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalItems = items.length;
  const activeMeta = SHEET_META[activeSheet] || SHEET_META['CP Standard'];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Drilling SOR — 2026 Rates</h2>
          <p className="text-xs text-slate-500">Schedule of Rates for drilling & investigation activities (meterage, sums, mobilisation)</p>
        </div>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalItems} rates</span>
      </div>

      {/* Sheet tabs */}
      <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto no-scrollbar border-b border-slate-100">
        {SHEET_ORDER.map(sheetName => {
          const meta = SHEET_META[sheetName];
          const Icon = meta.icon;
          const active = activeSheet === sheetName;
          return (
            <button key={sheetName} onClick={() => setActiveSheet(sheetName)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 whitespace-nowrap ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" /> {meta.label}
              <span className="text-xs text-slate-400">({counts[sheetName] || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Search + Upload */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${activeSheet} rates...`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 flex-shrink-0">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Processing...' : 'Upload SOR Excel'}
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[55vh]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400 space-y-2">
            <PoundSterling className="w-8 h-8 text-slate-200 mx-auto" />
            <p>No SOR rates for <span className="font-medium text-slate-600">{activeSheet}</span> yet.</p>
            <p>Upload your SOR Excel file (use the 2026 uplift column) to populate all sheets.</p>
          </div>
        ) : (
          grouped.map(([heading, headingItems]) => (
            <div key={heading} className="border-b border-slate-100 last:border-0">
              <div className="px-4 py-2 bg-slate-50/80 sticky top-0 z-10 flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${activeMeta.color}`}><ActiveIcon className="w-3.5 h-3.5" /></span>
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{heading}</p>
                <span className="text-[10px] text-slate-400 ml-auto">{headingItems.length} items</span>
              </div>
              {headingItems.map(item => <SORItemRow key={item.id} item={item} onUpdate={refresh} />)}
              <AddSORForm sheetName={activeSheet} onAdded={refresh} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}