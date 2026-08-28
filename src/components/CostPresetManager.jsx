import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, X, Trash2, Edit2, ChevronDown, ChevronUp, Truck, ShoppingCart, Wrench, ShieldCheck, Receipt, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blankItemForm = () => ({
  description: '', category: 'hired_equipment', supplier_id: '',
  unit_cost: '', quantity: '1', unit_label: 'day', vat_exempt: false,
  site_asset_id: '', reference_number: '',
  rate_card_item_id: '', men: ''
});

const categoryMeta = {
  hired_equipment: { label: 'Hired', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
  internal_equipment: { label: 'Internal', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' }
};

export default function CostPresetManager() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [presetForm, setPresetForm] = useState({ name: '', description: '', category: '' });
  const [savingPreset, setSavingPreset] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(blankItemForm());
  const [savingItem, setSavingItem] = useState(false);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['cost-presets'],
    queryFn: async () => {
      const list = await base44.entities.CostPreset.filter({});
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    }
  });

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets-presets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: rateCardItems = [] } = useQuery({ queryKey: ['rate-card-items-presets'], queryFn: () => base44.entities.RateCardItem.list('-created_date', 500) });

  const { data: allItems = [] } = useQuery({
    queryKey: ['all-preset-items'],
    queryFn: () => base44.entities.PresetItem.list()
  });

  const itemsFor = (presetId) => allItems.filter(i => i.preset_id === presetId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const presetTotal = (presetId) => itemsFor(presetId).reduce((s, i) => s + (Number(i.unit_cost) || 0) * (Number(i.quantity) || 1), 0);

  // Daily cost: for per-day items, unit_cost × (men or 1). This shows what a set costs per day.
  const itemDailyCost = (item) => {
    if (item.unit_label !== 'day') return 0;
    const men = Number(item.men) || 1;
    return (Number(item.unit_cost) || 0) * men;
  };
  const presetDailyTotal = (presetId) => itemsFor(presetId).reduce((s, i) => s + itemDailyCost(i), 0);

  // Rate card items scoped by supplier (our company if no supplier selected)
  const scopedRateItems = useMemo(() => {
    return (rateCardItems || []).filter(i => {
      if (i.is_active === false) return false;
      if (!itemForm.supplier_id) return i.rate_card_source !== 'supplier';
      return i.rate_card_source === 'supplier' && i.supplier_id === itemForm.supplier_id;
    });
  }, [rateCardItems, itemForm.supplier_id]);

  const pickFromRateCard = (id) => {
    if (!id) return;
    const rc = (rateCardItems || []).find(r => r.id === id);
    if (!rc) return;
    setItemForm(p => ({
      ...p,
      description: rc.description || p.description,
      unit_cost: String(rc.price ?? ''),
      unit_label: rc.unit || p.unit_label || 'day',
      men: rc.men != null ? String(rc.men) : p.men,
      rate_card_item_id: rc.id,
      notes: rc.notes || p.notes,
    }));
  };

  const savePreset = async (e) => {
    e.preventDefault();
    if (!presetForm.name.trim()) return;
    setSavingPreset(true);
    try {
      if (editingPresetId) {
        await base44.entities.CostPreset.update(editingPresetId, presetForm);
      } else {
        await base44.entities.CostPreset.create({ ...presetForm, is_active: true });
      }
      queryClient.invalidateQueries({ queryKey: ['cost-presets'] });
      setPresetForm({ name: '', description: '', category: '' });
      setEditingPresetId(null);
      setShowPresetForm(false);
    } catch (err) { console.error(err); }
    setSavingPreset(false);
  };

  const editPreset = (p) => {
    setPresetForm({ name: p.name, description: p.description || '', category: p.category || '' });
    setEditingPresetId(p.id);
    setShowPresetForm(true);
  };

  const deletePreset = async (id) => {
    if (!confirm('Delete this preset and all its items?')) return;
    const items = itemsFor(id);
    if (items.length > 0) {
      await base44.entities.PresetItem.deleteMany({ preset_id: id });
    }
    await base44.entities.CostPreset.delete(id);
    queryClient.invalidateQueries({ queryKey: ['cost-presets'] });
    queryClient.invalidateQueries({ queryKey: ['all-preset-items'] });
    if (expandedId === id) setExpandedId(null);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.description.trim() || !expandedId) return;
    setSavingItem(true);
    try {
      const payload = {
        preset_id: expandedId,
        description: itemForm.description,
        category: itemForm.category,
        supplier_id: itemForm.supplier_id || '',
        rate_card_item_id: itemForm.rate_card_item_id || '',
        men: itemForm.men === '' ? null : Number(itemForm.men),
        unit_cost: Number(itemForm.unit_cost) || 0,
        quantity: Number(itemForm.quantity) || 1,
        unit_label: itemForm.unit_label,
        vat_exempt: !!itemForm.vat_exempt,
        site_asset_id: itemForm.site_asset_id || '',
        reference_number: itemForm.reference_number || ''
      };
      if (editingItemId) {
        await base44.entities.PresetItem.update(editingItemId, payload);
      } else {
        await base44.entities.PresetItem.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['all-preset-items'] });
      setItemForm(blankItemForm());
      setEditingItemId(null);
      setShowItemForm(false);
    } catch (err) { console.error(err); }
    setSavingItem(false);
  };

  const editItem = (item) => {
    setItemForm({
      description: item.description, category: item.category || 'hired_equipment',
      supplier_id: item.supplier_id || '', unit_cost: String(item.unit_cost ?? ''),
      quantity: String(item.quantity ?? '1'), unit_label: item.unit_label || 'day',
      vat_exempt: !!item.vat_exempt,
      site_asset_id: item.site_asset_id || '',
      reference_number: item.reference_number || '',
      rate_card_item_id: item.rate_card_item_id || '',
      men: item.men != null ? String(item.men) : ''
    });
    setEditingItemId(item.id);
    setShowItemForm(true);
  };

  const selectAsset = (assetId) => {
    if (!assetId) {
      setItemForm(p => ({ ...p, site_asset_id: '', reference_number: '' }));
      return;
    }
    const asset = assets.find(a => a.id === assetId);
    setItemForm(p => ({
      ...p,
      site_asset_id: assetId,
      description: asset?.name || p.description,
      reference_number: asset?.serial_number || ''
    }));
  };

  const deleteItem = async (id) => {
    await base44.entities.PresetItem.delete(id);
    queryClient.invalidateQueries({ queryKey: ['all-preset-items'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Equipment Presets</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">{presets.length}</span>
        </div>
        <button onClick={() => { setEditingPresetId(null); setPresetForm({ name: '', description: '', category: '' }); setShowPresetForm(s => !s); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95">
          {showPresetForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Preset</>}
        </button>
      </div>
      <p className="text-sm text-slate-500 -mt-2">Create standard equipment lists (like a drilling rig setup) to add to any job in one click.</p>

      {/* Preset create/edit form */}
      <Dialog open={showPresetForm} onOpenChange={(open) => { if (!open) { setShowPresetForm(false); setEditingPresetId(null); setPresetForm({ name: '', description: '', category: '' }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingPresetId ? 'Edit Preset' : 'New Preset'}</DialogTitle></DialogHeader>
          <form onSubmit={savePreset} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Preset Name *</label>
              <input value={presetForm.name} onChange={e => setPresetForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Rotary Rig Setup"
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category (optional)</label>
              <input value={presetForm.category} onChange={e => setPresetForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. drilling, groundworks"
                className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input value={presetForm.description} onChange={e => setPresetForm(p => ({ ...p, description: e.target.value }))} placeholder="When to use this preset"
              className={inputCls} />
          </div>
          <button type="submit" disabled={savingPreset}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
            {savingPreset ? 'Saving…' : editingPresetId ? 'Update Preset' : 'Create Preset'}
          </button>
        </form>
        </DialogContent>
      </Dialog>

      {/* Preset list */}
      {isLoading ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 h-24 animate-pulse" />
      ) : presets.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 py-12 text-center">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No presets yet</p>
          <p className="text-sm text-slate-400 mt-1">Create a preset to add standard equipment lists to jobs in one click.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map(p => {
            const items = itemsFor(p.id);
            const total = presetTotal(p.id);
            const isExpanded = expandedId === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 transition text-left">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-500">{fmt(total)}</span>
                      {p.description && <><span>·</span><span className="truncate">{p.description}</span></>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-3.5 space-y-2 bg-slate-50/40">
                    {/* Item form */}
                    {showItemForm ? (
                      <form onSubmit={saveItem} className="bg-white rounded-lg border border-emerald-200 p-3 space-y-2">
                        <p className="text-xs font-semibold text-emerald-700">{editingItemId ? 'Edit item' : 'Add item to preset'}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Rate card quick-pick — auto-fills description, cost, unit and men */}
                          {scopedRateItems.length > 0 && (
                            <div className="sm:col-span-2">
                              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                                <Receipt className="w-3 h-3 text-emerald-700" /> Pick from rate card {itemForm.supplier_id ? '(this supplier)' : '(our rate card)'}
                              </label>
                              <select value="" onChange={(e) => { pickFromRateCard(e.target.value); e.target.value = ''; }} className={inputCls}>
                                <option value="">Select a rate to auto-fill…</option>
                                {scopedRateItems.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.description} · {r.price != null ? fmt(r.price) : (r.price_text || 'POA')}{r.unit ? `/${r.unit}` : ''}{r.men ? ` · ${r.men} men` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Link to Asset (GC Compliance Manager)</label>
                            <select value={itemForm.site_asset_id} onChange={e => selectAsset(e.target.value)} className={inputCls}>
                              <option value="">No link — enter manually</option>
                              {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` · ${a.serial_number}` : ''}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                            <input value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} required placeholder="Item description *"
                              className={inputCls} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Serial</label>
                            <input value={itemForm.reference_number} onChange={e => setItemForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="Auto-filled from linked asset"
                              className={inputCls} />
                          </div>
                          <div>
                            <select value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value, unit_label: e.target.value === 'hired_equipment' ? 'day' : 'each', supplier_id: e.target.value === 'internal_equipment' ? '' : p.supplier_id }))}
                              className={inputCls}>
                              <option value="hired_equipment">Hired Equipment</option>
                              <option value="purchased_equipment">Purchased Equipment</option>
                              <option value="internal_equipment">Internal Equipment</option>
                            </select>
                          </div>
                          <div>
                            <select value={itemForm.supplier_id} onChange={e => setItemForm(p => ({ ...p, supplier_id: e.target.value }))} disabled={itemForm.category === 'internal_equipment'}
                              className={inputCls}>
                              <option value="">{itemForm.category === 'internal_equipment' ? 'N/A' : 'Supplier (optional)'}</option>
                              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <input type="number" min="0" step="0.01" value={itemForm.unit_cost} onChange={e => setItemForm(p => ({ ...p, unit_cost: e.target.value }))} required placeholder="Unit cost £ *"
                              className={inputCls} />
                          </div>
                          <div className="flex gap-2">
                            <select value={itemForm.unit_label} onChange={e => setItemForm(p => ({ ...p, unit_label: e.target.value }))}
                              className={inputCls}>
                              <option value="day">per day</option>
                              <option value="hour">per hour</option>
                              <option value="m">per metre</option>
                              <option value="each">each</option>
                            </select>
                            {itemForm.unit_label !== 'day' && (
                              <input type="number" min="0" step="0.01" value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: e.target.value }))} placeholder="Qty"
                                className={`${inputCls} w-20`} />
                            )}
                          </div>
                          {/* Men field — for labour items, calculates total daily cost */}
                          <div>
                            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Users className="w-3 h-3 text-slate-400" /> Men (crew size)</label>
                            <input type="number" min="0" step="1" value={itemForm.men} onChange={e => setItemForm(p => ({ ...p, men: e.target.value }))} placeholder="1"
                              className={inputCls} />
                          </div>
                          {/* Live daily cost preview */}
                          {itemForm.unit_label === 'day' && Number(itemForm.unit_cost) > 0 && (
                            <div className="sm:col-span-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center justify-between">
                              <span>Daily cost: {fmt(Number(itemForm.unit_cost) || 0)}{Number(itemForm.men) > 1 ? ` × ${itemForm.men} men` : ''}</span>
                              <span className="font-bold">{fmt((Number(itemForm.unit_cost) || 0) * (Number(itemForm.men) || 1))}/day</span>
                            </div>
                          )}
                          <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2 cursor-pointer">
                            <input type="checkbox" checked={itemForm.vat_exempt} onChange={e => setItemForm(p => ({ ...p, vat_exempt: e.target.checked }))} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                            VAT exempt
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={savingItem} className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800 disabled:opacity-50">
                            {savingItem ? 'Saving…' : editingItemId ? 'Update' : 'Add'}
                          </button>
                          <button type="button" onClick={() => { setShowItemForm(false); setEditingItemId(null); setItemForm(blankItemForm()); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button onClick={() => { setEditingItemId(null); setItemForm(blankItemForm()); setShowItemForm(true); }}
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                          <Plus className="w-3.5 h-3.5" /> Add item
                        </button>
                        <div className="flex items-center gap-1">
                          <button onClick={() => editPreset(p)} className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deletePreset(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    {items.length > 0 && presetDailyTotal(p.id) > 0 && (
                      <div className="text-xs text-slate-500 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100 flex items-center justify-between">
                        <span className="font-medium">Set daily cost (per-day items only)</span>
                        <span className="font-bold text-blue-700">{fmt(presetDailyTotal(p.id))}/day</span>
                      </div>
                    )}

                    {/* Item list */}
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No items in this preset yet. Add items above.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map(item => {
                          const meta = categoryMeta[item.category] || categoryMeta.hired_equipment;
                          const Icon = meta.icon;
                          const net = (Number(item.unit_cost) || 0) * (Number(item.quantity) || 1);
                          return (
                            <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium text-slate-900 truncate">{item.description}</p>
                                  {item.men != null && item.men > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      <Users className="w-2.5 h-2.5" /> {item.men} man{item.men > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {item.rate_card_item_id && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                      <Receipt className="w-2.5 h-2.5" /> Rate card
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400">
                                  {fmt(item.unit_cost)} / {item.unit_label}
                                  {item.quantity > 1 && ` × ${item.quantity}`}
                                  {' · '}{meta.label}
                                  {item.vat_exempt && ' · VAT exempt'}
                                  {item.reference_number && ` · ${item.reference_number}`}
                                </p>
                                {item.unit_label === 'day' && item.men > 1 && (
                                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{fmt((Number(item.unit_cost) || 0) * item.men)}/day total</p>
                                )}
                                {item.site_asset_id && (() => {
                                  const la = assets.find(a => a.id === item.site_asset_id);
                                  return la && <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium mt-1"><ShieldCheck className="w-2.5 h-2.5" /> {la.name}</span>;
                                })()}
                              </div>
                              <p className="text-sm font-bold text-slate-700 flex-shrink-0">{fmt(net)}</p>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button onClick={() => editItem(item)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <span className="text-xs font-semibold text-slate-600">Preset total</span>
                          <span className="text-sm font-bold text-emerald-700">{fmt(total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}