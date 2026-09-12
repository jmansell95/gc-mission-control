import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Gift, ShoppingBag, Ticket, Coffee, Star, Loader2, CheckCircle2, Clock,
  X, Sparkles, Award, TrendingUp, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const ICON_MAP = { Gift, ShoppingBag, Ticket, Coffee, Award, Star, Sparkles };

const TYPE_LABELS = {
  gift_card: { label: 'Gift Card', icon: Gift, grad: 'stat-gradient-amber' },
  merchandise: { label: 'Merchandise', icon: ShoppingBag, grad: 'stat-gradient-violet' },
  experience: { label: 'Experience', icon: Ticket, grad: 'stat-gradient-blue' },
  custom: { label: 'Reward', icon: Sparkles, grad: 'stat-gradient-brand' },
};

const STATUS_CFG = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  fulfilled: { label: 'Fulfilled', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500', icon: XCircle },
};

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function RewardsCatalogue({ staffId, staffName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [redeeming, setRedeeming] = useState(null);
  const [confirmReward, setConfirmReward] = useState(null);

  const weekStart = getWeekStart();

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['rewards-active'],
    queryFn: () => base44.entities.Reward.filter({ is_active: true }, 'sort_order', 100),
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['incentive-scores-all', staffId],
    queryFn: () => base44.entities.IncentiveScore.filter({ staff_id: staffId }, '-week_start', 200),
    enabled: !!staffId,
  });

  const { data: redemptions = [], isLoading: redLoading } = useQuery({
    queryKey: ['my-redemptions', staffId],
    queryFn: () => base44.entities.RewardRedemption.filter({ staff_id: staffId }, '-requested_at', 100),
    enabled: !!staffId,
  });

  const totalEarned = useMemo(() => scores.reduce((s, r) => s + (Number(r.total_points) || 0), 0), [scores]);
  const totalSpent = useMemo(
    () => redemptions.filter(r => r.status !== 'cancelled').reduce((s, r) => s + (Number(r.points_spent) || 0), 0),
    [redemptions]
  );
  const balance = totalEarned - totalSpent;
  const weekScore = scores.find(s => s.week_start === weekStart);

  const handleRedeem = async () => {
    if (!confirmReward) return;
    setRedeeming(confirmReward.id);
    try {
      const res = await base44.functions.invoke('redeemReward', {
        staff_id: staffId,
        staff_name: staffName,
        reward_id: confirmReward.id,
      });
      if (res.data?.success === false || (res.data?.error && !res.data?.redemption)) {
        toast({ title: 'Redemption failed', description: res.data.error || 'Please try again.', variant: 'destructive' });
      } else {
        toast({ title: 'Reward redeemed!', description: `${confirmReward.name} — an admin will be in touch to fulfil it.` });
        queryClient.invalidateQueries({ queryKey: ['my-redemptions', staffId] });
        queryClient.invalidateQueries({ queryKey: ['rewards-active'] });
        setConfirmReward(null);
      }
    } catch (e) {
      toast({ title: 'Redemption failed', description: e.message, variant: 'destructive' });
    }
    setRedeeming(null);
  };

  if (rewardsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-28 rounded-2xl bg-slate-100/60 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Points balance hero */}
      <div className="relative overflow-hidden rounded-3xl hero-gradient p-5 md:p-6 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-yellow-300/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-emerald-300/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center backdrop-blur-sm">
              <Star className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-wide">My Points Balance</p>
              <p className="text-4xl font-extrabold tabular-nums leading-none mt-1">{balance.toLocaleString()}</p>
              <p className="text-emerald-100/80 text-xs mt-1">
                {totalEarned.toLocaleString()} earned · {totalSpent.toLocaleString()} spent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
            <TrendingUp className="w-4 h-4 text-yellow-300" />
            <div>
              <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wide">This Week</p>
              <p className="text-lg font-extrabold tabular-nums leading-none">{weekScore?.total_points || 0} pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rewards grid */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Gift className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-extrabold text-slate-900">Rewards Catalogue</h3>
          <span className="text-xs text-slate-400">· {rewards.length} available</span>
        </div>
        {rewards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 bg-white/40">
            <EmptyState icon={Gift} title="No rewards yet" message="Your manager hasn't added any rewards to the catalogue yet. Keep earning points!" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {rewards.map(r => {
              const tc = TYPE_LABELS[r.reward_type] || TYPE_LABELS.custom;
              const TIcon = ICON_MAP[r.icon] || tc.icon;
              const outOfStock = r.stock_count != null && r.stock_count <= 0;
              const canAfford = balance >= (r.points_cost || 0);
              const accent = r.accent_color || '#2E5A1A';
              return (
                <div key={r.id} className="hub-glass rounded-2xl overflow-hidden flex flex-col">
                  {/* Tile header */}
                  <div className={`${tc.grad} relative h-20 flex items-center justify-center`}>
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                    ) : (
                      <TIcon className="w-10 h-10 text-white/90 drop-shadow" />
                    )}
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/85 text-slate-700 backdrop-blur-sm">
                      {tc.label}
                    </span>
                    {r.gift_card_value_gbp && (
                      <span className="absolute bottom-2 left-2 text-sm font-extrabold text-white drop-shadow tabular-nums">
                        £{r.gift_card_value_gbp}
                      </span>
                    )}
                  </div>
                  {/* Body */}
                  <div className="p-3.5 flex flex-col flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{r.name}</p>
                    {r.brand && <p className="text-[10px] font-semibold mt-0.5" style={{ color: accent }}>{r.brand}</p>}
                    {r.description && <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-snug">{r.description}</p>}
                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-[#2E5A1A] tabular-nums">
                        <Star className="w-3.5 h-3.5 text-amber-500" /> {r.points_cost.toLocaleString()}
                      </span>
                      {r.stock_count != null && (
                        <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-full ' + (outOfStock ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700')}>
                          {outOfStock ? 'Out of stock' : `${r.stock_count} left`}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setConfirmReward(r)}
                      disabled={outOfStock || !canAfford}
                      className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed command-gradient text-white shadow-sm hover:shadow-md"
                    >
                      {outOfStock ? 'Unavailable' : !canAfford ? 'Not enough points' : <><Gift className="w-4 h-4" /> Redeem</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My redemptions */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-extrabold text-slate-900">My Redemptions</h3>
          <span className="text-xs text-slate-400">· {redemptions.length}</span>
        </div>
        {redLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : redemptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 bg-white/40 text-center">
            <p className="text-sm text-slate-400">No redemptions yet — redeem a reward above to see it here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {redemptions.map(r => {
              const st = STATUS_CFG[r.status] || STATUS_CFG.pending;
              const SIcon = st.icon;
              return (
                <div key={r.id} className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{r.reward_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {r.requested_at ? format(new Date(r.requested_at), 'dd MMM yyyy') : ''} · <span className="font-semibold text-[#2E5A1A]">{r.points_spent} pts</span>
                      {r.gift_card_value_gbp ? ` · £${r.gift_card_value_gbp}` : ''}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${st.cls} flex-shrink-0`}>
                    <SIcon className="w-3 h-3" /> {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmReward && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={() => !redeeming && setConfirmReward(null)}>
          <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-sm sm:rounded-3xl sm:shadow-2xl p-6 sm:animate-pop-in flex flex-col justify-center" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl stat-gradient-amber flex items-center justify-center shadow-lg mb-3">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Redeem {confirmReward.name}?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will spend <span className="font-bold text-[#2E5A1A]">{confirmReward.points_cost.toLocaleString()} points</span> from your balance.
              </p>
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Current Balance</p>
                  <p className="text-lg font-extrabold text-slate-900 tabular-nums">{balance.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">After Redeem</p>
                  <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{(balance - confirmReward.points_cost).toLocaleString()}</p>
                </div>
              </div>
              <div className="w-full flex gap-2 mt-5">
                <button onClick={() => setConfirmReward(null)} disabled={redeeming}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleRedeem} disabled={redeeming}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg transition disabled:opacity-60">
                  {redeeming === confirmReward.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {redeeming === confirmReward.id ? 'Redeeming…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}