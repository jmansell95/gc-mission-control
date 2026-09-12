import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Gift, Plus, Edit2, Trash2, X, Loader2, Star, ShoppingBag, Ticket, Coffee,
  Sparkles, Award, CheckCircle2, Clock, XCircle, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const ICON_MAP = { Gift, ShoppingBag, Ticket, Coffee, Award, Star, Sparkles };
const TYPE_LABELS = {
  gift_card: 'Gift Card', merchandise: 'Merchandise', experience: 'Experience', custom: 'Custom',
};
const REDEMPTION_STATUS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  fulfilled: { label: 'Fulfilled', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500', icon: XCircle },
};

const EMPTY_FORM = {
  name: '', description: '', brand: '', icon: 'Gift', reward_type: 'gift_card',
  points_cost: 500, gift_card_value_gbp: 25, stock_count: '', image_url: '', accent_color: '', is_active: true, sort_order: 0,
};

export default function RewardsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('rewards');

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['rewards-all'],
    queryFn: () => base44.entities.Reward.list('sort_order', 200),
  });
  const { data: redemptions = [], isLoading: redLoading } = useQuery({
    queryKey: ['all-redemptions'],
    queryFn: () => base44.entities.RewardRedemption.list('-requested_at', 200),
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      name: r.name || '', description: r.description || '', brand: r.brand || '', icon: r.icon || 'Gift',
      reward_type: r.reward_type || 'gift_card', points_cost: r.points_cost || 0,
      gift_card_value_gbp: r.gift_card_value_gbp || '', stock_count: r.stock_count ?? '', image_url: r.image_url || '',
      accent_color: r.accent_color || '', is_active: r.is_active !== false, sort_order: r.sort_order || 0,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.points_cost) {
      toast({ title: 'Name and points cost are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        points_cost: Number(form.points_cost) || 0,
        gift_card_value_gbp: form.gift_card_value_gbp === '' ? null : Number(form.gift_card_value_gbp),
        stock_count: form.stock_count === '' ? null : Number(form.stock_count),
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        await base44.entities.Reward.update(editingId, payload);
        toast({ title: 'Reward updated' });
      } else {
        await base44.entities.Reward.create(payload);
        toast({ title: 'Reward created' });
      }
      queryClient.invalidateQueries({ queryKey: ['rewards-all'] });
      queryClient.invalidateQueries({ queryKey: ['rewards-active'] });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (r) => {
    if (!confirm(`Delete "${r.name}"? Existing redemptions are retained.`)) return;
    try {
      await base44.entities.Reward.delete(r.id);
      queryClient.invalidateQueries({ queryKey: ['rewards-all'] });
      queryClient.invalidateQueries({ queryKey: ['rewards-active'] });
      toast({ title: 'Reward deleted' });
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const updateRedemptionStatus = async (red, status) => {
    try {
      const updates = { status };
      if (status === 'fulfilled') updates.fulfilled_at = new Date().toISOString();
      await base44.entities.RewardRedemption.update(red.id, updates);
      queryClient.invalidateQueries({ queryKey: ['all-redemptions'] });
      toast({ title: `Redemption ${status}` });
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const pendingCount = redemptions.filter(r => r.status === 'pending').length;

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl hero-gradient p-5 md:p-6 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-yellow-300/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center backdrop-blur-sm">
              <Gift className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Rewards Manager</h2>
              <p className="text-emerald-100 text-sm">Create gift cards & rewards, fulfil staff redemptions</p>
            </div>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition">
            <Plus className="w-4 h-4" /> Add Reward
          </button>
        </div>
      </div>

      {/* Toggle: Rewards / Redemptions */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        <button onClick={() => setView('rewards')}
          className={'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ' + (view === 'rewards' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Gift className="w-3.5 h-3.5" /> Catalogue ({rewards.length})
        </button>
        <button onClick={() => setView('redemptions')}
          className={'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ' + (view === 'redemptions' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Clock className="w-3.5 h-3.5" /> Redemptions
          {pendingCount > 0 && <span className="min-w-[18px] h-4 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{pendingCount}</span>}
        </button>
      </div>

      {view === 'rewards' ? (
        isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : rewards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 bg-white/50">
            <EmptyState icon={Gift} title="No rewards yet" message="Create your first reward to let staff redeem their points." actionLabel="Add Reward" onAction={openCreate} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rewards.map(r => {
              const Icon = ICON_MAP[r.icon] || Gift;
              const outOfStock = r.stock_count != null && r.stock_count <= 0;
              return (
                <div key={r.id} className="hub-glass rounded-2xl p-4 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{TYPE_LABELS[r.reward_type] || 'Reward'}{r.brand ? ` · ${r.brand}` : ''}</p>
                    </div>
                    <span className={'text-[9px] font-bold px-1.5 py-0.5 rounded-full ' + (r.is_active === false ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700')}>
                      {r.is_active === false ? 'Hidden' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-primary"><Star className="w-3.5 h-3.5 text-amber-500" />{Number(r.points_cost).toLocaleString()} pts</span>
                    {r.gift_card_value_gbp && <span className="text-slate-500 font-semibold">£{r.gift_card_value_gbp}</span>}
                    {r.stock_count != null && <span className={'font-semibold ' + (outOfStock ? 'text-red-500' : 'text-slate-500')}>{outOfStock ? 'Out of stock' : `${r.stock_count} in stock`}</span>}
                  </div>
                  <div className="mt-auto pt-3 flex gap-2">
                    <button onClick={() => openEdit(r)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(r)} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="hub-glass rounded-2xl overflow-hidden">
          {redLoading ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : redemptions.length === 0 ? (
            <div className="p-8"><EmptyState icon={Clock} title="No redemptions yet" message="Staff redemptions will appear here for fulfilment." /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {redemptions.map(r => {
                const st = REDEMPTION_STATUS[r.status] || REDEMPTION_STATUS.pending;
                const SIcon = st.icon;
                return (
                  <div key={r.id} className="p-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Gift className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.reward_name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {r.staff_name || 'Staff'} · {r.requested_at ? format(new Date(r.requested_at), 'dd MMM yyyy') : ''}
                        {' · '}<span className="font-semibold text-primary">{r.points_spent} pts</span>
                        {r.gift_card_value_gbp ? ` · £${r.gift_card_value_gbp}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${st.cls} flex-shrink-0`}>
                      <SIcon className="w-3 h-3" /> {st.label}
                    </span>
                    {r.status === 'pending' && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => updateRedemptionStatus(r, 'approved')} title="Approve" className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => updateRedemptionStatus(r, 'cancelled')} title="Cancel (refund points)" className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"><XCircle className="w-4 h-4" /></button>
                      </div>
                    )}
                    {r.status === 'approved' && (
                      <button onClick={() => updateRedemptionStatus(r, 'fulfilled')} title="Mark fulfilled" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition flex-shrink-0"><CheckCircle2 className="w-4 h-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-lg">{editingId ? 'Edit Reward' : 'New Reward'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amazon £25 Gift Card" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Terms, delivery info" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Brand</label>
                  <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Amazon" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={form.reward_type} onChange={e => setForm({ ...form, reward_type: e.target.value })} className={inputCls}>
                    <option value="gift_card">Gift Card</option>
                    <option value="merchandise">Merchandise</option>
                    <option value="experience">Experience</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Points Cost *</label>
                  <input type="number" value={form.points_cost} onChange={e => setForm({ ...form, points_cost: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gift Card £</label>
                  <input type="number" value={form.gift_card_value_gbp} onChange={e => setForm({ ...form, gift_card_value_gbp: e.target.value })} placeholder="25" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Stock</label>
                  <input type="number" value={form.stock_count} onChange={e => setForm({ ...form, stock_count: e.target.value })} placeholder="Unlimited" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Icon</label>
                  <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className={inputCls}>
                    {Object.keys(ICON_MAP).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Accent Colour</label>
                  <input type="text" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} placeholder="#FF9900" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Image URL (optional)</label>
                <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer pt-1">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
                Active (visible in staff catalogue)
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Update Reward' : 'Create Reward'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}