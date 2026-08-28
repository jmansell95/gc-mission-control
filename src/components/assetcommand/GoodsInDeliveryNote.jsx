import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Store, ArrowLeft, Package, Plus, Search, Loader2, CheckCircle2,
  XCircle, AlertCircle, Send, Trash2, ChevronUp, ChevronDown, ScanLine,
  ClipboardList, Box,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import { playSuccess, playError, playConfirm } from '@/utils/scanFeedback';

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
 * Goods-In delivery note flow — build a delivery note with expected line
 * items, scan barcodes to match against the catalog, enter received
 * quantities, and commit all to stock in one batch.
 *
 * Props: onBack
 */
export default function GoodsInDeliveryNote({ onBack }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [supplierName, setSupplierName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [lineItems, setLineItems] = useState([]); // { key, consumable_item_id, item_name, category, unit, expected_qty, received_qty, matched, scan_value }
  const [search, setSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanError, setScanError] = useState('');

  const { data: consumables = [], isLoading } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.filter({ is_active: true }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-goods-in'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return consumables.slice(0, 16);
    const q = search.toLowerCase();
    return consumables.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.sku || '').toLowerCase().includes(q) ||
      (c.barcode || '').toLowerCase().includes(q));
  }, [consumables, search]);

  const addLineItem = (consumable) => {
    setLineItems(prev => {
      if (prev.find(li => li.consumable_item_id === consumable.id)) {
        toast({ title: 'Already added', description: consumable.name });
        return prev;
      }
      return [...prev, {
        key: `${consumable.id}-${Date.now()}`,
        consumable_item_id: consumable.id,
        item_name: consumable.name,
        category: consumable.category,
        unit: consumable.unit || 'each',
        expected_qty: 1,
        received_qty: 1,
        matched: false,
        scan_value: '',
      }];
    });
    setSearch('');
    setShowCatalog(false);
    playSuccess();
  };

  const handleScan = useCallback(async (val) => {
    const q = val.trim();
    if (!q) return;
    setScanError('');
    try {
      const res = await base44.functions.invoke('resolveConsumableByBarcode', { scan: q });
      const data = res.data || res;
      const item = data.item;
      if (item) {
        playSuccess();
        // Match against existing line items first
        setLineItems(prev => {
          const existing = prev.find(li => li.consumable_item_id === item.id);
          if (existing) {
            toast({ title: 'Matched line', description: item.name });
            return prev.map(li => li.consumable_item_id === item.id ? { ...li, matched: true, received_qty: li.received_qty + 1, scan_value: q } : li);
          }
          // No existing line — add a new matched one
          toast({ title: 'Added from catalog', description: item.name });
          return [...prev, {
            key: `${item.id}-${Date.now()}`,
            consumable_item_id: item.id,
            item_name: item.name,
            category: item.category,
            unit: item.unit || 'each',
            expected_qty: 1,
            received_qty: 1,
            matched: true,
            scan_value: q,
          }];
        });
      } else {
        playError();
        setScanError(q);
        toast({ title: 'Not in catalog', description: 'Add as ad-hoc line below or ignore.', variant: 'default' });
      }
    } catch (e) {
      playError();
      setScanError(q);
    }
  }, [toast]);

  const updateLineItem = (key, field, value) => {
    setLineItems(prev => prev.map(li => li.key === key ? { ...li, [field]: value } : li));
  };

  const removeLineItem = (key) => {
    setLineItems(prev => prev.filter(li => li.key !== key));
  };

  const addAdHocLine = () => {
    setLineItems(prev => [...prev, {
      key: `adhoc-${Date.now()}`,
      consumable_item_id: null,
      item_name: scanError || '',
      category: 'other',
      unit: 'each',
      expected_qty: 1,
      received_qty: 1,
      matched: false,
      scan_value: scanError,
    }]);
    setScanError('');
  };

  const totalReceived = lineItems.reduce((s, li) => s + (Number(li.received_qty) || 0), 0);
  const matchedCount = lineItems.filter(li => li.matched).length;
  const canCommit = lineItems.length > 0 && !submitting;

  const handleCommit = async () => {
    if (!canCommit) return;
    setSubmitting(true);
    try {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Scanner';

      const receipts = lineItems.map(li => ({
        item_name: li.item_name,
        consumable_item_id: li.consumable_item_id || null,
        category: li.category || 'other',
        quantity_received: Number(li.received_qty) || 0,
        unit: li.unit || 'each',
        supplier_name: supplierName || null,
        po_number: poNumber || null,
        notes: null,
      }));

      const res = await base44.functions.invoke('commitGoodsIn', {
        receipts,
        received_by_staff_id: me?.id,
        received_by_name: myName,
        supplier_name: supplierName,
        po_number: poNumber,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ['goods-in-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] });
      playConfirm();
      toast({
        title: 'Committed to Stock',
        description: `${data.receipts_created || receipts.length} receipt(s) created · ${data.stock_updated || 0} stock levels updated.`,
      });

      // Reset
      setLineItems([]);
      setSupplierName('');
      setPoNumber('');
      setSearch('');
      setScanError('');
    } catch (e) {
      toast({ title: 'Commit failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <button onClick={onBack} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Store className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Goods In</h1>
            <p className="text-xs text-slate-400">Delivery note → scan → stock</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4 pb-32">
          {/* Delivery note header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-bold text-slate-900">Delivery Note</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
                <input
                  list="goods-in-suppliers"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="Where from?"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
                <datalist id="goods-in-suppliers">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">PO Number</label>
                <input
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder="PO ref"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Scanner */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative">
            <BarcodeScanner
              onScan={handleScan}
              onSearch={(v) => { setSearch(v); setShowCatalog(true); setScanError(''); }}
              placeholder="Scan barcode or search catalog…"
              autoFocus={false}
            />
            {scanError && (
              <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-800 font-medium flex-1 truncate">Unrecognised: "{scanError}"</p>
                <button onClick={addAdHocLine} className="text-xs font-bold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-100 transition">
                  + Add as line
                </button>
                <button onClick={() => setScanError('')} className="p-1 text-amber-400 hover:text-amber-600">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Catalog picker (collapsible) */}
          {showCatalog && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {isLoading ? 'Loading…' : `${filtered.length} items`}
                </p>
                <button onClick={() => setShowCatalog(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No items match. Scan to add ad-hoc.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {filtered.map(c => {
                    const cat = CATEGORY_META[c.category] || CATEGORY_META.other;
                    return (
                      <button
                        key={c.id}
                        onClick={() => addLineItem(c)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition active:scale-[0.98] text-left"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                          <p className="text-xs text-slate-400">Stock: {c.current_stock || 0} {c.unit}{c.sku && ` · ${c.sku}`}</p>
                        </div>
                        <Plus className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-amber-600" />
                  {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
                </p>
                <span className="text-xs text-slate-400">{matchedCount} matched · {totalReceived} total qty</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {lineItems.map(li => {
                    const cat = CATEGORY_META[li.category] || CATEGORY_META.other;
                    return (
                      <motion.div
                        key={li.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`rounded-xl border p-3 ${li.matched ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">{li.item_name}</p>
                            <p className="text-[11px] text-slate-400">
                              {li.matched ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Matched
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">Ad-hoc</span>
                              )}
                              {li.scan_value && <span className="font-mono"> · {li.scan_value}</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => removeLineItem(li.key)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5 pl-10">
                          <label className="text-[11px] text-slate-500 font-medium">Received qty</label>
                          <button
                            onClick={() => updateLineItem(li.key, 'received_qty', Math.max(0, (Number(li.received_qty) || 0) - 1))}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 active:scale-95"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={li.received_qty}
                            onChange={e => updateLineItem(li.key, 'received_qty', e.target.value)}
                            className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-center tabular-nums focus:outline-none focus:border-amber-500"
                          />
                          <button
                            onClick={() => updateLineItem(li.key, 'received_qty', (Number(li.received_qty) || 0) + 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 active:scale-95"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] text-slate-400 font-medium ml-1">{li.unit}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty state */}
          {lineItems.length === 0 && !scanError && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center mx-auto mb-3 ring-4 ring-amber-50">
                <ScanLine className="w-10 h-10 text-amber-300" />
              </div>
              <p className="text-slate-700 font-bold text-base">Ready to Receive</p>
              <p className="text-slate-400 text-sm mt-1">Scan a barcode or tap an item from the catalogue to start your delivery note.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky commit bar */}
      {lineItems.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-bottom z-50">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleCommit}
              disabled={submitting || !canCommit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {submitting ? 'Committing…' : `Commit ${lineItems.length} Line${lineItems.length !== 1 ? 's' : ''} to Stock`}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}