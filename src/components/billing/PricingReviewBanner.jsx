import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertCircle, Loader2, X, Check, Trash2, Search, ShieldCheck, Eye, Zap,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * PricingReviewBanner — surfaces logs with pricing_review_status =
 * 'pending_review' so the billing team can confirm or correct the
 * fuzzy-proposed rate card match. Confirmation teaches the dictionary.
 */
export default function PricingReviewBanner({ jobId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [selectedRCI, setSelectedRCI] = useState({});
  const [view, setView] = useState('pending'); // 'pending' | 'auto_matched'

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pricing-review-pending', jobId],
    queryFn: () => base44.entities.InvestigationLog.filter({ pricing_review_status: 'pending_review' }, '-created_date', 100),
    refetchInterval: 30000,
  });

  // Auto-matched logs for spot-checking (high-confidence dictionary matches)
  const { data: autoMatched = [], isLoading: autoLoading } = useQuery({
    queryKey: ['pricing-review-auto-matched', jobId],
    queryFn: () => base44.entities.InvestigationLog.filter({ pricing_review_status: 'auto_matched', chargeable: true }, '-created_date', 100),
    refetchInterval: 30000,
    enabled: open,
  });

  // Filter to just this job when jobId is provided (job Financials tab)
  const filteredPending = jobId ? pending.filter(l => l.job_id === jobId) : pending;
  const filteredAuto = jobId ? autoMatched.filter(l => l.job_id === jobId) : autoMatched;

  const { data: rateCardItems = [] } = useQuery({
    queryKey: ['rate-card-items-for-review'],
    queryFn: () => base44.entities.RateCardItem.filter({ is_active: true }, 'description', 500),
    enabled: open,
  });

  const count = filteredPending.length;
  const autoCount = filteredAuto.length;

  const handleConfirm = async (log) => {
    setConfirming(log.id);
    const rciId = selectedRCI[log.id] || log.suggested_rate_card_item_id;
    if (!rciId) {
      setConfirming(null);
      return;
    }
    const rci = rateCardItems.find(r => r.id === rciId);
    const qty = Number(log.units_completed) ||
      ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) || 1;
    const total = Math.round(Number(rci?.price || 0) * qty * 100) / 100;
    try {
      // Confirm the dictionary mapping
      await base44.functions.invoke('resolveLogPricing', {
        confirm_mapping: true,
        log_id: log.id,
        keyword: log.description,
        rate_card_item_id: rciId,
        category: rci?.category || 'drilling',
        confirmed_by: 'billing',
      });
      // Stamp the charge
      await base44.entities.InvestigationLog.update(log.id, {
        chargeable: true,
        charge_amount: total,
        billing_status: 'auto',
        pricing_review_status: 'reviewed',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: 'billing',
        charge_breakdown: JSON.stringify({
          source: 'keyword_dictionary_confirmed',
          rate_card_item_id: rciId,
          unit_price: rci?.price,
          quantity: qty,
          total,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['pricing-review-pending'] });
    } catch (e) { console.error(e); }
    setConfirming(null);
  };

  const handleReject = async (log) => {
    setConfirming(log.id);
    try {
      await base44.entities.InvestigationLog.update(log.id, {
        chargeable: false,
        charge_amount: 0,
        billing_status: 'no_charge',
        pricing_review_status: 'rejected',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: 'billing',
      });
      queryClient.invalidateQueries({ queryKey: ['pricing-review-pending'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-review-auto-matched'] });
    } catch (e) { console.error(e); }
    setConfirming(null);
  };

  // Spot-check confirm: mark an auto-matched log as 'reviewed' (billing team
  // validated the dictionary match). No re-pricing needed — the charge was
  // already stamped by the auto-matcher.
  const handleSpotCheckConfirm = async (log) => {
    setConfirming(log.id);
    try {
      await base44.entities.InvestigationLog.update(log.id, {
        pricing_review_status: 'reviewed',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: 'billing',
      });
      queryClient.invalidateQueries({ queryKey: ['pricing-review-auto-matched'] });
    } catch (e) { console.error(e); }
    setConfirming(null);
  };

  // Spot-check reprice: replace the auto-matched rate card item with a
  // manually selected one and re-stamp the charge.
  const handleSpotCheckReprice = async (log) => {
    const rciId = selectedRCI[log.id];
    if (!rciId) { setConfirming(null); return; }
    setConfirming(log.id);
    const rci = rateCardItems.find(r => r.id === rciId);
    const qty = Number(log.units_completed) ||
      ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) || 1;
    const total = Math.round(Number(rci?.price || 0) * qty * 100) / 100;
    try {
      await base44.entities.InvestigationLog.update(log.id, {
        charge_amount: total,
        charge_breakdown: JSON.stringify({
          source: 'spot_check_reprice',
          rate_card_item_id: rciId,
          unit_price: rci?.price,
          quantity: qty,
          total,
        }),
        pricing_review_status: 'reviewed',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: 'billing',
      });
      queryClient.invalidateQueries({ queryKey: ['pricing-review-auto-matched'] });
    } catch (e) { console.error(e); }
    setConfirming(null);
  };

  if (count === 0 && autoCount === 0 && !open) return null;

  const activeList = view === 'pending' ? filteredPending : filteredAuto;
  const filtered = search
    ? activeList.filter(l => (l.description || '').toLowerCase().includes(search.toLowerCase()))
    : activeList;
  const isLoadingView = view === 'pending' ? isLoading : autoLoading;

  return (
    <>
      {/* Banner */}
      <button
        onClick={() => setOpen(true)}
        className="w-full hub-glass rounded-2xl p-3 flex items-center justify-between gap-3 bg-amber-50 border-amber-200 hover:bg-amber-100/80 transition active:scale-[0.99] mb-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-amber-800">Pricing Review Queue</p>
            <p className="text-[11px] text-amber-700">
              {count} pending{autoCount > 0 ? ` · ${autoCount} auto-matched to spot-check` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {autoCount > 0 && (
            <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold tabular-nums">{autoCount}</span>
          )}
          <span className="px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-bold tabular-nums">{count}</span>
        </div>
      </button>

      {/* Review modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Pricing Review Queue</h3>
                <p className="text-xs text-slate-400">Confirm or correct the suggested rate card match for each log</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View toggle */}
            <div className="flex gap-1 p-3 border-b border-slate-100">
              <button
                onClick={() => setView('pending')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  view === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Pending Review
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${view === 'pending' ? 'bg-white/25' : 'bg-slate-200'}`}>{count}</span>
              </button>
              <button
                onClick={() => setView('auto_matched')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  view === 'auto_matched' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Auto-Matched
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${view === 'auto_matched' ? 'bg-white/25' : 'bg-slate-200'}`}>{autoCount}</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search descriptions…"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingView ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-500">All caught up!</p>
                  <p className="text-xs text-slate-400">
                    {view === 'pending' ? 'No logs awaiting pricing review.' : 'No auto-matched logs to spot-check.'}
                  </p>
                </div>
              ) : (
                filtered.map(log => {
                  const suggestedRCI = rateCardItems.find(r => r.id === (selectedRCI[log.id] || log.suggested_rate_card_item_id));
                  const qty = Number(log.units_completed) ||
                    ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) || 1;
                  const isAuto = view === 'auto_matched';
                  return (
                    <div key={log.id} className="hub-glass rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isAuto && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wide flex-shrink-0">
                                <Zap className="w-2.5 h-2.5" /> Auto
                              </span>
                            )}
                            <p className="text-sm font-semibold text-slate-800">{log.description || '—'}</p>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {log.date || '—'} · {log.borehole_ref || 'no ref'} · Qty: {qty} {log.units_label || ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {suggestedRCI && (
                            <span className="text-xs font-bold text-emerald-700 tabular-nums">
                              {fmt(suggestedRCI.price)} / {suggestedRCI.unit || 'sum'}
                            </span>
                          )}
                          {isAuto && log.charge_amount != null && (
                            <p className="text-[10px] text-slate-400 tabular-nums">Charged: {fmt(log.charge_amount)}</p>
                          )}
                        </div>
                      </div>
                      {/* Rate card item selector */}
                      <select
                        value={selectedRCI[log.id] || log.suggested_rate_card_item_id || ''}
                        onChange={e => setSelectedRCI(prev => ({ ...prev, [log.id]: e.target.value }))}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">Select rate card item…</option>
                        {rateCardItems.map(rci => (
                          <option key={rci.id} value={rci.id}>
                            {rci.description} ({fmt(rci.price)}/{rci.unit || 'sum'})
                          </option>
                        ))}
                      </select>
                      {/* Actions */}
                      {isAuto ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSpotCheckConfirm(log)}
                            disabled={confirming === log.id}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition active:scale-95"
                          >
                            {confirming === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Looks Correct
                          </button>
                          {selectedRCI[log.id] && (
                            <button
                              onClick={() => handleSpotCheckReprice(log)}
                              disabled={confirming === log.id}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition active:scale-95"
                            >
                              {confirming === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Re-price
                            </button>
                          )}
                          <button
                            onClick={() => handleReject(log)}
                            disabled={confirming === log.id}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition active:scale-95 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleConfirm(log)}
                            disabled={confirming === log.id || (!selectedRCI[log.id] && !log.suggested_rate_card_item_id)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition active:scale-95"
                          >
                            {confirming === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Confirm & Price
                          </button>
                          <button
                            onClick={() => handleReject(log)}
                            disabled={confirming === log.id}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition active:scale-95 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}