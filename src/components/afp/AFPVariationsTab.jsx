import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  GitBranch, AlertTriangle, Check, X, Loader2, RefreshCw, Clock,
  CheckCircle2, TrendingUp, ArrowRight, FileText,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB');

/**
 * AFPVariationsTab — manager review queue for BOQ overruns.
 * Lists draft variation rows auto-created by checkBOQVariations, grouped by
 * the original BOQ line. Managers approve (with reason) or reject each draft.
 * Approved variations flow into the AFP variations sheet via the real-time sync.
 */
export default function AFPVariationsTab({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [reasons, setReasons] = useState({});

  // All variation rows for this job (drafts + approved)
  const { data: variationLines = [], isLoading } = useQuery({
    queryKey: ['boq-variations', job.id],
    queryFn: () => base44.entities.JobBillOfQuantities.filter({ job_id: job.id, is_variation: true }, '-approved_at', 500),
  });

  // Original BOQ lines for context (agreed vs actual)
  const { data: originalLines = [] } = useQuery({
    queryKey: ['boq-originals', job.id],
    queryFn: () => base44.entities.JobBillOfQuantities.filter({ job_id: job.id, is_variation: { $ne: true } }, 'sort_order', 500),
  });

  const originalById = useMemo(() => new Map(originalLines.map((l) => [l.id, l])), [originalLines]);

  const pending = useMemo(() => variationLines.filter((v) => v.status === 'not_started'), [variationLines]);
  const approved = useMemo(() => variationLines.filter((v) => v.status === 'complete'), [variationLines]);

  const pendingValue = useMemo(() =>
    pending.reduce((s, v) => s + (Number(v.agreed_line_total) || 0), 0), [pending]);
  const approvedValue = useMemo(() =>
    approved.reduce((s, v) => s + (Number(v.agreed_line_total) || 0), 0), [approved]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke('checkBOQVariations', { job_id: job.id });
      const data = res.data || res;
      queryClient.invalidateQueries({ queryKey: ['boq-variations', job.id] });
      queryClient.invalidateQueries({ queryKey: ['boq-originals', job.id] });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      const drafts = data.drafts_created || 0;
      const overruns = (data.overruns || []).length;
      toast({
        title: 'Variations checked',
        description: `${overruns} overrun(s) found · ${drafts} new draft variation(s) queued for review.`,
      });
    } catch (e) {
      toast({ title: 'Check failed', description: e?.message, variant: 'destructive' });
    }
    setChecking(false);
  };

  const handleApprove = async (variation) => {
    const reason = reasons[variation.id];
    if (!reason?.trim()) {
      toast({ title: 'Reason required', description: 'Enter a justification for the variation.', variant: 'destructive' });
      return;
    }
    setApprovingId(variation.id);
    try {
      const approverName = authUser?.full_name || authUser?.email || 'Admin';
      // Approve the variation row
      await base44.entities.JobBillOfQuantities.update(variation.id, {
        status: 'complete',
        variation_reason: reason.trim(),
        approved_by_name: approverName,
        approved_at: new Date().toISOString(),
      });
      // Mark the original BOQ line as 'variation' (approved overrun)
      if (variation.variation_of_id) {
        await base44.entities.JobBillOfQuantities.update(variation.variation_of_id, { status: 'variation' });
      }
      queryClient.invalidateQueries({ queryKey: ['boq-variations', job.id] });
      queryClient.invalidateQueries({ queryKey: ['boq-originals', job.id] });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      queryClient.invalidateQueries({ queryKey: ['afp-line-items'] });
      setReasons((p) => ({ ...p, [variation.id]: '' }));
      toast({
        title: 'Variation approved',
        description: `+${fmtQty(variation.agreed_quantity)} ${variation.unit || ''} will flow into the next AFP variations sheet.`,
      });
    } catch (e) {
      toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' });
    }
    setApprovingId(null);
  };

  const handleReject = async (variation) => {
    if (!confirm('Reject this variation? The overrun will remain flagged on the original BOQ line, blocking billing readiness.')) return;
    setRejectingId(variation.id);
    try {
      await base44.entities.JobBillOfQuantities.delete(variation.id);
      queryClient.invalidateQueries({ queryKey: ['boq-variations', job.id] });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'Variation rejected', description: 'The original BOQ line remains in overrun status.' });
    } catch (e) {
      toast({ title: 'Reject failed', description: e?.message, variant: 'destructive' });
    }
    setRejectingId(null);
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with summary + actions */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Measured Works</h3>
              <p className="text-xs text-slate-500">Overruns against the original contracted BOQ — review and approve before billing</p>
            </div>
          </div>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Check Variations
          </button>
        </div>
        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50">
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pending Review</p>
            <p className="text-base font-bold text-amber-600">{pending.length}</p>
            <p className="text-[10px] text-slate-400">{fmt(pendingValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Approved</p>
            <p className="text-base font-bold text-emerald-600">{approved.length}</p>
            <p className="text-[10px] text-slate-400">{fmt(approvedValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Variations</p>
            <p className="text-base font-bold text-slate-900">{variationLines.length}</p>
            <p className="text-[10px] text-slate-400">{fmt(pendingValue + approvedValue)}</p>
          </div>
        </div>
      </div>

      {/* Pending variations — approval queue */}
      {pending.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pending Review</span>
            <span className="text-[10px] text-slate-400">· auto-detected overruns awaiting approval</span>
          </div>
          {pending.map((variation) => {
            const original = originalById.get(variation.variation_of_id);
            return (
              <VariationCard
                key={variation.id}
                variation={variation}
                original={original}
                reason={reasons[variation.id] || ''}
                onReasonChange={(v) => setReasons((p) => ({ ...p, [variation.id]: v }))}
                onApprove={() => handleApprove(variation)}
                onReject={() => handleReject(variation)}
                approving={approvingId === variation.id}
                rejecting={rejectingId === variation.id}
                pending
              />
            );
          })}
        </div>
      )}

      {/* Approved variations — history */}
      {approved.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Approved</span>
            <span className="text-[10px] text-slate-400">· flow into the AFP variations sheet</span>
          </div>
          {approved.map((variation) => {
            const original = originalById.get(variation.variation_of_id);
            return (
              <VariationCard
                key={variation.id}
                variation={variation}
                original={original}
                approved
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {variationLines.length === 0 && (
        <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <GitBranch className="w-7 h-7 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">No variations detected</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            When actual logged work exceeds the contracted BOQ scope, a draft variation is auto-created
            here for your review. Run "Check Variations" to scan now, or wait for the nightly detection.
          </p>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Check Now
          </button>
        </div>
      )}
    </div>
  );
}

function VariationCard({ variation, original, reason, onReasonChange, onApprove, onReject, approving, rejecting, pending, approved }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className={`hub-glass rounded-2xl overflow-hidden ${pending ? 'border-amber-200' : 'border-emerald-200'}`}>
      <div className={`px-3 py-2 flex items-center gap-2 ${pending ? 'bg-amber-50/60' : 'bg-emerald-50/60'}`}>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {pending ? 'PENDING' : 'APPROVED'}
        </span>
        {variation.sor_ref && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">{variation.sor_ref}</span>}
        <span className="text-xs font-semibold text-slate-700 truncate flex-1">{variation.description}</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{fmt(variation.agreed_line_total)}</span>
      </div>
      <div className="p-3 space-y-2.5">
        {/* Original vs actual comparison */}
        {original && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400">Contracted:</span>
              <span className="font-bold text-slate-700">{fmtQty(original.agreed_quantity)} {original.unit || ''}</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-rose-400">Actual:</span>
              <span className="font-bold text-rose-700">{fmtQty(original.actual_quantity)} {original.unit || ''}</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 border border-violet-200">
              <span className="text-violet-400">Variation:</span>
              <span className="font-bold text-violet-700">+{fmtQty(variation.agreed_quantity)} {variation.unit || ''}</span>
            </div>
          </div>
        )}
        {/* Line details */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>@ {fmt(variation.agreed_unit_price)}/{variation.unit || 'ea'}</span>
          <span>·</span>
          <span className="capitalize">{variation.category || 'other'}</span>
          {variation.subcategory && (<><span>·</span><span>{variation.subcategory}</span></>)}
        </div>
        {/* Approved metadata */}
        {approved && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <Check className="w-3 h-3 text-emerald-500" />
            <span>Approved by <strong className="text-slate-700">{variation.approved_by_name || 'Admin'}</strong> on {fmtDate(variation.approved_at)}</span>
            {variation.variation_reason && (
              <span className="text-slate-400 truncate">· "{variation.variation_reason}"</span>
            )}
          </div>
        )}
        {/* Pending: reason input + actions */}
        {pending && (
          <>
            <div className="flex gap-2">
              <input
                value={reason || ''}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Variation reason (e.g. Client instructed additional 19 days beyond original 71-day scope)…"
                className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={onApprove}
                disabled={approving}
                className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={onReject}
                disabled={rejecting}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition active:scale-95 hover:bg-rose-50 disabled:opacity-50"
              >
                {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}