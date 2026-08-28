import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Package, CheckCircle2, XCircle, Clock, Search, AlertCircle,
  Store, TrendingUp, Loader2, ChevronDown, ChevronRight, Plus, Edit3, Trash2,
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

export default function GoodsInPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showVerified, setShowVerified] = useState(false);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['goods-in-receipts'],
    queryFn: () => base44.entities.GoodsInReceipt.list('-received_date', 200),
  });

  const { data: consumables = [] } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.filter({ is_active: true }),
  });

  const pending = useMemo(
    () => receipts.filter(r => r.status === 'pending_verification'),
    [receipts]
  );
  const verified = useMemo(
    () => receipts.filter(r => r.status === 'verified').sort((a, b) => new Date(b.verified_at || b.received_date) - new Date(a.verified_at || a.received_date)),
    [receipts]
  );
  const rejected = useMemo(
    () => receipts.filter(r => r.status === 'rejected'),
    [receipts]
  );

  const lowStock = useMemo(
    () => consumables.filter(c => c.minimum_stock > 0 && (c.current_stock || 0) <= c.minimum_stock),
    [consumables]
  );

  const filteredPending = useMemo(() => {
    if (!search.trim()) return pending;
    const q = search.toLowerCase();
    return pending.filter(r =>
      (r.item_name || '').toLowerCase().includes(q) ||
      (r.supplier_name || '').toLowerCase().includes(q) ||
      (r.received_by_name || '').toLowerCase().includes(q));
  }, [pending, search]);

  const handleVerify = async (receipt) => {
    try {
      const now = new Date().toISOString();
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Manager';

      await base44.entities.GoodsInReceipt.update(receipt.id, {
        status: 'verified',
        verified_by_staff_id: me?.id,
        verified_by_name: myName,
        verified_at: now,
      });

      // If linked to a consumable, bump the stock level
      if (receipt.consumable_item_id) {
        const consumable = consumables.find(c => c.id === receipt.consumable_item_id);
        if (consumable) {
          const newStock = (consumable.current_stock || 0) + (receipt.quantity_received || 0);
          await base44.entities.ConsumableStockItem.update(consumable.id, {
            current_stock: newStock,
            last_stock_count_date: receipt.received_date,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['goods-in-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] });
      toast({ title: 'Receipt verified', description: `${receipt.item_name} — stock updated.` });
    } catch (e) {
      toast({ title: 'Verification failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleReject = async (receipt, reason) => {
    try {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Manager';
      await base44.entities.GoodsInReceipt.update(receipt.id, {
        status: 'rejected',
        verified_by_staff_id: me?.id,
        verified_by_name: myName,
        verified_at: new Date().toISOString(),
        rejection_reason: reason || 'Discrepancy',
      });
      queryClient.invalidateQueries({ queryKey: ['goods-in-receipts'] });
      toast({ title: 'Receipt rejected', description: `${receipt.item_name} — not counted.`, variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Failed to reject', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Clock} label="Pending" value={pending.length} tint="bg-amber-50 text-amber-700 border-amber-200" />
        <StatTile icon={CheckCircle2} label="Verified" value={verified.length} tint="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <StatTile icon={XCircle} label="Rejected" value={rejected.length} tint="bg-rose-50 text-rose-700 border-rose-200" />
        <StatTile icon={AlertCircle} label="Low Stock" value={lowStock.length} tint="bg-orange-50 text-orange-700 border-orange-200" />
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-semibold text-orange-800">{lowStock.length} item{lowStock.length !== 1 ? 's' : ''} below minimum stock — reorder needed</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-orange-200 rounded-lg text-xs font-medium text-orange-700">
                {c.name}: {c.current_stock || 0} / {c.minimum_stock} {c.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending receipts */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-slate-900">Pending Goods In</h3>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{pending.length}</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pending…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : filteredPending.length === 0 ? (
          <EmptyState icon={Package} title="No pending receipts" message="Goods scanned in by staff will appear here for verification." />
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredPending.map(r => {
              const cat = CATEGORY_META[r.category] || CATEGORY_META.other;
              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.item_name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-600">{r.quantity_received} {r.unit}</span>
                      {r.supplier_name && <span>· from {r.supplier_name}</span>}
                      {r.received_by_name && <span>· by {r.received_by_name}</span>}
                      <span>· {r.received_date}</span>
                      {r.po_number && <span>· PO: {r.po_number}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleVerify(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection:', 'Wrong quantity');
                        if (reason !== null) handleReject(r, reason);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition active:scale-95 border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified history */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowVerified(s => !s)}
          className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-slate-50/50 transition"
        >
          {showVerified ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Verified History</h3>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{verified.length}</span>
        </button>
        {showVerified && (
          <div className="divide-y divide-slate-50 border-t border-slate-100">
            {verified.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No verified receipts yet" />
            ) : (
              verified.slice(0, 30).map(r => {
                const cat = CATEGORY_META[r.category] || CATEGORY_META.other;
                return (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${cat.tint}`}>
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.item_name}</p>
                      <p className="text-xs text-slate-400">
                        {r.quantity_received} {r.unit} · verified by {r.verified_by_name || '—'} · {r.verified_at ? new Date(r.verified_at).toLocaleDateString('en-GB') : r.received_date}
                      </p>
                    </div>
                    {r.status === 'rejected' && <span className="text-xs font-bold text-rose-600">Rejected</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tint }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${tint}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[10px] uppercase font-semibold tracking-wide opacity-80">{label}</p>
      </div>
    </div>
  );
}