import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Package, Plus, Search, Edit3, Trash2, X, Loader2, AlertCircle,
  Store, TrendingDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const CATEGORY_META = {
  ppe: { label: 'PPE', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  stationary: { label: 'Stationary', tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  electrical: { label: 'Electrical', tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  tools: { label: 'Tools', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  consumables: { label: 'Consumables', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cleaning: { label: 'Cleaning', tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  other: { label: 'Other', tint: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const CATEGORIES = Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label }));

export default function ConsumableInventoryManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.list('name'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-consumables'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const filtered = useMemo(() => {
    let result = [...items];
    if (catFilter !== 'all') result = result.filter(c => c.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.sku || '').toLowerCase().includes(q));
    }
    return result;
  }, [items, search, catFilter]);

  const lowStock = useMemo(
    () => items.filter(c => c.minimum_stock > 0 && (c.current_stock || 0) <= c.minimum_stock),
    [items]
  );

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await base44.entities.ConsumableStockItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] });
      toast({ title: 'Item deleted', description: item.name });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editing) {
        await base44.entities.ConsumableStockItem.update(editing.id, formData);
        toast({ title: 'Item updated', description: formData.name });
      } else {
        await base44.entities.ConsumableStockItem.create(formData);
        toast({ title: 'Item created', description: formData.name });
      }
      queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] });
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Consumable Inventory</h2>
          <p className="text-sm text-slate-500">Warehouse & depot consumables — PPE, stationary, electrical, tools</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-800">
            {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} at or below minimum stock — reorder needed.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={Package} title="No consumable items" message="Add items like bulbs, PPE, and stationary to start tracking warehouse stock." actionLabel="Add First Item" onAction={() => setShowForm(true)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => {
            const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
            const isLow = item.minimum_stock > 0 && (item.current_stock || 0) <= item.minimum_stock;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition group">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{cat.label}{item.sku ? ` · ${item.sku}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-2xl font-bold ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.current_stock || 0}
                      <span className="text-sm font-normal text-slate-400 ml-1">{item.unit}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Min: {item.minimum_stock || 0} {item.unit}
                    </p>
                  </div>
                  {isLow && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
                      <AlertCircle className="w-3 h-3" /> Reorder
                    </span>
                  )}
                </div>
                {item.storage_location && (
                  <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">📍 {item.storage_location}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create modal */}
      {showForm && (
        <ConsumableFormModal
          item={editing}
          suppliers={suppliers}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ConsumableFormModal({ item, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'consumables',
    sku: item?.sku || '',
    barcode: item?.barcode || '',
    unit: item?.unit || 'each',
    current_stock: item?.current_stock || 0,
    minimum_stock: item?.minimum_stock || 0,
    reorder_quantity: item?.reorder_quantity || 0,
    storage_location: item?.storage_location || '',
    supplier_id: item?.supplier_id || '',
    supplier_name: item?.supplier_name || '',
    unit_cost: item?.unit_cost || 0,
    notes: item?.notes || '',
    is_active: item?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const payload = {
      ...form,
      current_stock: Number(form.current_stock) || 0,
      minimum_stock: Number(form.minimum_stock) || 0,
      reorder_quantity: Number(form.reorder_quantity) || 0,
      unit_cost: Number(form.unit_cost) || 0,
      supplier_name: supplier?.name || form.supplier_name || null,
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between z-10">
            <h3 className="font-bold text-slate-900">{item ? 'Edit Item' : 'Add Consumable Item'}</h3>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Item Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
                <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">SKU / Part No.</label>
                <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Barcode</label>
                <input value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Current Stock</label>
                <input type="number" min="0" value={form.current_stock} onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Min Stock</label>
                <input type="number" min="0" value={form.minimum_stock} onChange={e => setForm(p => ({ ...p, minimum_stock: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reorder Qty</label>
                <input type="number" min="0" value={form.reorder_quantity} onChange={e => setForm(p => ({ ...p, reorder_quantity: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Unit Cost (£)</label>
                <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
                <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500">
                  <option value="">None</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Storage Location</label>
              <input value={form.storage_location} onChange={e => setForm(p => ({ ...p, storage_location: e.target.value }))}
                placeholder="e.g. Bay 3 — Shelf A"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3.5 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold hover:bg-emerald-800 transition disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}