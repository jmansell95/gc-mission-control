import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Package, Plus, Search, Loader2, CheckCircle2, Store,
  ArrowLeft, ClipboardList, Send,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import { playSuccess, playError } from '@/utils/scanFeedback';

const CATEGORY_META = {
  ppe: { label: 'PPE', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  stationary: { label: 'Stationary', tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  electrical: { label: 'Electrical', tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  tools: { label: 'Tools', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  consumables: { label: 'Consumables', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cleaning: { label: 'Cleaning', tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  other: { label: 'Other', tint: 'bg-slate-50 text-slate-700 border-slate-200' },
};

/**
 * Goods In Scanner — simplified "Quick Receive" mode for the scanner page.
 * Anyone can scan or select a consumable, enter a quantity, and submit it
 * as a pending GoodsInReceipt for gatekeeper verification.
 */
export default function GoodsInScanner({ onBack }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [supplierName, setSupplierName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState([]);

  const { data: consumables = [], isLoading } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.filter({ is_active: true }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-goods-in'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return consumables.slice(0, 20);
    const q = search.toLowerCase();
    return consumables.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.sku || '').toLowerCase().includes(q) ||
      (c.barcode || '').toLowerCase().includes(q));
  }, [consumables, search]);

  const handleScan = useCallback((val) => {
    const q = val.trim().toLowerCase();
    if (!q) return;
    const found = consumables.find(c => {
      const bc = (c.barcode || '').toLowerCase().trim();
      const sku = (c.sku || '').toLowerCase().trim();
      const nm = (c.name || '').toLowerCase().trim();
      return bc === q || sku === q || nm === q || (bc && bc.includes(q)) || (sku && sku.includes(q));
    });
    if (found) {
      playSuccess();
      setSelectedItem(found);
      setSearch(found.name);
      toast({ title: 'Item found', description: found.name });
    } else {
      playError();
      // No match — treat as ad-hoc item
      setSelectedItem(null);
      setSearch(val);
      toast({ title: 'Not in catalog', description: 'Will be submitted as ad-hoc item.', variant: 'default' });
    }
  }, [consumables, toast]);

  const handleSubmit = async () => {
    if (!search.trim() || quantity <= 0) {
      toast({ title: 'Missing details', description: 'Enter an item name and quantity.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Scanner';
      const today = new Date().toISOString().slice(0, 10);

      const payload = {
        item_name: selectedItem ? selectedItem.name : search.trim(),
        consumable_item_id: selectedItem ? selectedItem.id : null,
        category: selectedItem ? selectedItem.category : 'other',
        quantity_received: Number(quantity),
        unit: selectedItem ? selectedItem.unit : 'each',
        received_by_staff_id: me?.id,
        received_by_name: myName,
        received_date: today,
        supplier_name: supplierName || null,
        po_number: poNumber || null,
        notes: notes || null,
        status: 'pending_verification',
      };

      const created = await base44.entities.GoodsInReceipt.create(payload);
      setRecentReceipts(prev => [created, ...prev].slice(0, 5));
      queryClient.invalidateQueries({ queryKey: ['goods-in-receipts'] });
      playSuccess();
      toast({ title: 'Submitted for verification', description: `${payload.item_name} (${quantity} ${payload.unit}) queued for depot lead review.` });

      // Reset form
      setSelectedItem(null);
      setSearch('');
      setQuantity(1);
      setSupplierName('');
      setPoNumber('');
      setNotes('');
    } catch (e) {
      toast({ title: 'Submission failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Store className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Goods In</h1>
            <p className="text-xs text-slate-400">Scan or select items to book into stock</p>
          </div>
        </div>
        <button onClick={onBack} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {/* Scanner */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <BarcodeScanner onScan={handleScan} onSearch={(v) => { setSearch(v); setSelectedItem(null); }} placeholder="Scan barcode or type item name…" autoFocus={false} />
          </div>

          {/* Item picker */}
          {!selectedItem && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {isLoading ? 'Loading items…' : `${filtered.length} items in catalog`}
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No catalogue items match. Submit as ad-hoc below.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {filtered.map(c => {
                    const cat = CATEGORY_META[c.category] || CATEGORY_META.other;
                    const isLow = c.minimum_stock > 0 && (c.current_stock || 0) <= c.minimum_stock;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedItem(c); setSearch(c.name); setQuantity(1); playSuccess(); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition active:scale-[0.98] text-left"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                          <p className="text-xs text-slate-400">
                            Stock: {c.current_stock || 0} {c.unit}
                            {c.sku && ` · SKU: ${c.sku}`}
                          </p>
                        </div>
                        {isLow && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">Low</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected item detail + form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-bold text-slate-900">Receipt Details</p>
            </div>

            {/* Item name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Item Name</label>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedItem(null); }}
                placeholder="Item name (or select from list above)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
                <input
                  value={selectedItem?.unit || 'each'}
                  disabled={!!selectedItem}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500"
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Supplier (optional)</label>
              <input
                list="goods-in-suppliers"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="Where did this come from?"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              />
              <datalist id="goods-in-suppliers">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>

            {/* PO Number */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PO Number (optional)</label>
              <input
                value={poNumber}
                onChange={e => setPoNumber(e.target.value)}
                placeholder="Purchase order reference"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Condition, discrepancies, etc."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Recent submissions */}
          {recentReceipts.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Recent Submissions</p>
              <div className="space-y-1.5">
                {recentReceipts.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-medium text-emerald-800">{r.item_name}</span>
                    <span className="text-emerald-600">— {r.quantity_received} {r.unit} · pending verification</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky submit bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting || !search.trim() || quantity <= 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {submitting ? 'Submitting…' : 'Submit for Verification'}
          </button>
        </div>
      </footer>
    </div>
  );
}