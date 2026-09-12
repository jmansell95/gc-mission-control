import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Loader2, UserCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STATUS_CONFIG = {
  verified_net: { label: 'Net (30%)', Icon: ShieldCheck, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified_gross: { label: 'Gross (0%)', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  unknown: { label: 'Unknown', Icon: ShieldAlert, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  failed: { label: 'Failed', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  pending: { label: 'Pending', Icon: ShieldAlert, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export default function CISBatchVerifyWidget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, results: [] });

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 500),
  });

  const pending = contractors.filter(c => c.cis_status === 'pending' && (c.utr || c.nino));

  const handleBatchVerify = async () => {
    if (pending.length === 0) return;
    setVerifying(true);
    setProgress({ done: 0, total: pending.length, results: [] });
    const results = [];
    for (let i = 0; i < pending.length; i++) {
      const c = pending[i];
      try {
        const res = await base44.functions.invoke('verifyCIS', { contractor_id: c.id });
        const data = res?.data ?? res;
        results.push({
          name: c.name,
          status: data.cis_status || data.error ? (data.error ? 'failed' : data.cis_status) : 'failed',
          message: data.message || data.error || 'Verified',
        });
      } catch (e) {
        results.push({ name: c.name, status: 'failed', message: 'Verification error' });
      }
      setProgress({ done: i + 1, total: pending.length, results });
    }
    setVerifying(false);
    queryClient.invalidateQueries(['contractors']);
    const verified = results.filter(r => r.status === 'verified_net' || r.status === 'verified_gross').length;
    toast({
      title: `CIS batch verification complete`,
      description: `${verified} of ${results.length} subcontractor(s) verified.`,
    });
  };

  const stats = {
    verified: contractors.filter(c => c.cis_status === 'verified_net' || c.cis_status === 'verified_gross').length,
    pending: pending.length,
    unknown: contractors.filter(c => c.cis_status === 'unknown').length,
    failed: contractors.filter(c => c.cis_status === 'failed').length,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">CIS Verification Hub</h3>
            <p className="text-[11px] text-slate-400">HMRC Construction Industry Scheme batch verification</p>
          </div>
        </div>
        <button onClick={handleBatchVerify} disabled={verifying || pending.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50">
          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {verifying ? `Verifying ${progress.done}/${progress.total}` : `Verify ${pending.length} pending`}
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{stats.verified}</p>
            <p className="text-[9px] uppercase text-emerald-600 font-semibold">Verified</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
            <p className="text-lg font-bold text-slate-600 tabular-nums">{stats.pending}</p>
            <p className="text-[9px] uppercase text-slate-500 font-semibold">Pending</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
            <p className="text-lg font-bold text-orange-600 tabular-nums">{stats.unknown}</p>
            <p className="text-[9px] uppercase text-orange-500 font-semibold">Unknown</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
            <p className="text-lg font-bold text-red-600 tabular-nums">{stats.failed}</p>
            <p className="text-[9px] uppercase text-red-500 font-semibold">Failed</p>
          </div>
        </div>

        {/* Progress / results */}
        {verifying && progress.results.length > 0 && (
          <div className="space-y-1 mb-2">
            {progress.results.slice(-3).map((r, i) => {
              const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const RIcon = cfg.Icon;
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <RIcon className={`w-3 h-3 ${cfg.cls.split(' ')[1]}`} />
                  <span className="text-slate-600 font-medium truncate flex-1">{r.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.cls}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {pending.length === 0 && !verifying && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2.5">
            <ShieldCheck className="w-4 h-4" />
            <span>All subcontractors with UTR/NINO have been verified.</span>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-xs text-slate-400">Loading subcontractors…</div>
        )}
      </div>
    </div>
  );
}