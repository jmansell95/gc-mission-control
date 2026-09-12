import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Tag, Plus, Trash2, Loader2, Search, CheckCircle2,
  Zap, Edit3, X, Save,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

const CATEGORIES = ['drilling', 'plant_hire', 'labour', 'subcontractor', 'materials', 'mobilisation', 'delivery', 'other'];

/**
 * KeywordMappingManager — manages the keyword→rate-card dictionary.
 * Lives as a sub-section inside the Rate Card tab. Admins add/edit
 * keyword mappings that drive the hybrid auto-pricing of driller logs.
 */
export default function KeywordMappingManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ keyword: '', rate_card_item_id: '', category: 'drilling' });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['keyword-mappings'],
    queryFn: () => base44.entities.KeywordRateMapping.list('-match_count', 500),
  });

  const { data: rateCardItems = [] } = useQuery({
    queryKey: ['rate-card-items-for-keywords'],
    queryFn: () => base44.entities.RateCardItem.filter({ is_active: true }, 'description', 500),
  });

  const rciMap = {};
  for (const rci of rateCardItems) rciMap[rci.id] = rci;

  const filtered = search
    ? mappings.filter(m => (m.keyword || '').toLowerCase().includes(search.toLowerCase()))
    : mappings;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['keyword-mappings'] });

  const handleSave = async () => {
    if (!form.keyword || !form.rate_card_item_id) return;
    try {
      if (editing) {
        await base44.entities.KeywordRateMapping.update(editing, {
          keyword: form.keyword.toLowerCase().trim(),
          rate_card_item_id: form.rate_card_item_id,
          category: form.category,
          confidence_score: 1.0,
          is_confirmed: true,
        });
      } else {
        await base44.entities.KeywordRateMapping.create({
          keyword: form.keyword.toLowerCase().trim(),
          rate_card_item_id: form.rate_card_item_id,
          category: form.category,
          confidence_score: 1.0,
          is_confirmed: true,
        });
      }
      setForm({ keyword: '', rate_card_item_id: '', category: 'drilling' });
      setEditing(null);
      setShowAdd(false);
      invalidate();
    } catch (e) { console.error(e); }
  };

  const handleEdit = (m) => {
    setEditing(m.id);
    setForm({ keyword: m.keyword, rate_card_item_id: m.rate_card_item_id, category: m.category || 'drilling' });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.KeywordRateMapping.delete(id);
      invalidate();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Keyword Mapping</p>
            <p className="text-[11px] text-slate-400">Map driller log keywords to rate card items for auto-pricing</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ keyword: '', rate_card_item_id: '', category: 'drilling' }); setShowAdd(!showAdd); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Keyword
        </button>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="hub-glass rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">{editing ? 'Edit Keyword' : 'New Keyword Mapping'}</p>
            <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Keyword (e.g. 'CP Rig', 'Coreliner')"
              value={form.keyword}
              onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))}
              className="col-span-12 sm:col-span-4 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <select
              value={form.rate_card_item_id}
              onChange={e => setForm(p => ({ ...p, rate_card_item_id: e.target.value }))}
              className="col-span-12 sm:col-span-5 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select rate card item…</option>
              {rateCardItems.map(rci => (
                <option key={rci.id} value={rci.id}>
                  {rci.description} ({fmt(rci.price)}/{rci.unit || 'sum'})
                </option>
              ))}
            </select>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="col-span-7 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={!form.keyword || !form.rate_card_item_id}
              className="col-span-5 sm:col-span-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {editing ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search keywords…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
        />
      </div>

      {/* Mappings list */}
      {isLoading ? (
        <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Tag className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">No keyword mappings yet</p>
          <p className="text-xs text-slate-400 mt-1">Add keywords that drillers commonly log to auto-price them from the rate card.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(m => {
              const rci = rciMap[m.rate_card_item_id];
              return (
                <div key={m.id} className="hub-glass rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm">{m.keyword}</p>
                      <p className="text-[10px] text-slate-400 truncate">{rci?.description || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(m)} className="p-1.5 text-slate-400 hover:text-[#2E5A1A] transition">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">{m.category}</span>
                    <span className="font-bold text-emerald-700 tabular-nums">{fmt(rci?.price)}</span>
                    <span className="text-slate-400">{m.match_count || 0} matches</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hub-glass rounded-2xl overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80">
                  <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-3 py-2.5 font-semibold">Keyword</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Rate Card Item</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Category</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Price</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Confirmed</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Matches</th>
                    <th className="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(m => {
                    const rci = rciMap[m.rate_card_item_id];
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 group">
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{m.keyword}</td>
                        <td className="px-3 py-2.5 text-slate-600 truncate max-w-[200px]">{rci?.description || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">{m.category}</span>
                        </td>
                        <td className="text-right px-3 py-2.5 text-slate-700 font-medium tabular-nums">{fmt(rci?.price)}</td>
                        <td className="text-center px-3 py-2.5">
                          {m.is_confirmed !== false ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-[10px] text-amber-600">Pending</span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2.5 text-slate-500 tabular-nums">{m.match_count || 0}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => handleEdit(m)} className="p-1 text-slate-400 hover:text-[#2E5A1A] transition">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(m.id)} className="p-1 text-slate-400 hover:text-rose-600 transition">
                              <Trash2 className="w-3.5 h-3.5" />
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
        </>
      )}
    </div>
  );
}