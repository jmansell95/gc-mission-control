import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Receipt, Upload, Loader2, Search, Plus, Check, X, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const CATEGORY_META = {
  labour: { label: 'Labour', color: 'emerald' },
  plant: { label: 'Plant Hire', color: 'blue' },
  materials: { label: 'Materials', color: 'amber' },
};

/**
 * JobRateCardSubTab — job-specific rate card manager. Shows and edits
 * RateCardItem records scoped to this job. The AFP Builder's rate matcher
 * pulls from these job-specific rates first, then the global Master Price List.
 */
export default function JobRateCardSubTab({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('labour');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', unit: 'day', price: '', cost_price: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['job-rate-card', job.id],
    queryFn: () => base44.entities.RateCardItem.filter({ job_id: job.id }, 'sort_order', 500),
  });

  const jobItems = useMemo(() => items.filter(i => i.job_id === job.id), [items]);

  const counts = useMemo(() => ({
    labour: jobItems.filter(i => i.category === 'labour').length,
    plant: jobItems.filter(i => i.category === 'plant').length,
    materials: jobItems.filter(i => i.category === 'materials').length,
  }), [jobItems]);

  const filtered = useMemo(() => {
    let result = jobItems.filter(i => i.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => (i.description || '').toLowerCase().includes(q));
    }
    return result;
  }, [jobItems, activeCategory, search]);

  const handleAdd = async () => {
    if (!newItem.description) return;
    try {
      await base44.entities.RateCardItem.create({
        category: activeCategory,
        description: newItem.description,
        unit: newItem.unit,
        price: newItem.price === '' ? null : Number(newItem.price),
        cost_price: newItem.cost_price === '' ? null : Number(newItem.cost_price),
        job_id: job.id,
        division_id: job.division_id,
        rate_card_source: 'our_company',
        is_active: true,
        sort_order: jobItems.length,
      });
      setNewItem({ description: '', unit: 'day', price: '', cost_price: '' });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['job-rate-card', job.id] });
      toast({ title: 'Rate added', description: `${newItem.description} added to job rate card` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.RateCardItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ['job-rate-card', job.id] });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke('processRateCardUpload', {
        file_url,
        job_id: job.id,
        division_id: job.division_id,
      });
      queryClient.invalidateQueries({ queryKey: ['job-rate-card', job.id] });
      toast({ title: 'Rate card uploaded', description: 'Job-specific rates imported successfully' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Job Rate Card</h3>
            <p className="text-[11px] text-slate-400">Job-specific rates override the Master Price List for this job's AFPs</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rates…"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#2E5A1A]"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Add Rate
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleUpload(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              activeCategory === key
                ? `bg-${meta.color}-100 text-${meta.color}-700`
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {meta.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/50">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Add new rate form */}
      {showAdd && (
        <div className="hub-glass rounded-2xl p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Description"
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
              className="col-span-12 sm:col-span-5 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="text"
              placeholder="Unit"
              value={newItem.unit}
              onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
              className="col-span-4 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Sell Price"
              value={newItem.price}
              onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
              className="col-span-4 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Cost Price"
              value={newItem.cost_price}
              onChange={e => setNewItem(p => ({ ...p, cost_price: e.target.value }))}
              className="col-span-4 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <div className="col-span-12 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={handleAdd} disabled={!newItem.description} className="px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Rate items table */}
      {isLoading ? (
        <div className="hub-glass rounded-2xl p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No {CATEGORY_META[activeCategory].label} rates for this job</p>
          <p className="text-xs text-slate-400 mt-1">Add rates manually or upload a rate card file</p>
        </div>
      ) : (
        <div className="hub-glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Unit</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Sell Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Cost Price</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const margin = item.cost_price > 0 && item.price > 0
                    ? ((item.price - item.cost_price) / item.price) * 100
                    : null;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 group">
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{item.description}</td>
                      <td className="px-3 py-2.5 text-slate-500">{item.unit || '—'}</td>
                      <td className="text-right px-3 py-2.5 text-slate-700 font-semibold tabular-nums">{fmt(item.price)}</td>
                      <td className="text-right px-3 py-2.5 text-slate-500 tabular-nums">{fmt(item.cost_price)}</td>
                      <td className={`text-right px-3 py-2.5 font-semibold tabular-nums ${margin != null ? (margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-rose-600') : 'text-slate-400'}`}>
                        {margin != null ? `${margin.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}