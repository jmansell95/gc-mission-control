import React from 'react';
import { ShieldX, ShieldAlert, RefreshCw, ArrowUpRight } from 'lucide-react';

/**
 * Surfaces the assets that are NOT compliant (expired / expiring / unknown)
 * as pulled from the GC Compliance Manager during the last sync.
 *
 * The flow is: fix the item in GC Compliance Manager, then hit
 * "Sync Compliance" again to refresh these statuses here.
 */
export default function ComplianceAttentionPanel({ assets }) {
  const notCompliant = assets.filter(a =>
    a.compliance_status === 'expired' ||
    a.compliance_status === 'expiring' ||
    a.compliance_status === 'unknown'
  ).sort((a, b) => {
    // Expired first, then expiring (soonest expiry first), then unknown
    const order = { expired: 0, expiring: 1, unknown: 2 };
    const o = (order[a.compliance_status] ?? 3) - (order[b.compliance_status] ?? 3);
    if (o !== 0) return o;
    if (a.compliance_status === 'expiring') {
      return new Date(a.compliance_expiry_date || '2099-01-01') - new Date(b.compliance_expiry_date || '2099-01-01');
    }
    return 0;
  });

  if (notCompliant.length === 0) return null;

  const expiredCount = notCompliant.filter(a => a.compliance_status === 'expired').length;
  const expiringCount = notCompliant.filter(a => a.compliance_status === 'expiring').length;
  const unknownCount = notCompliant.filter(a => a.compliance_status === 'unknown').length;

  const rowStyle = (status) =>
    status === 'expired' ? 'bg-red-50/60 border-l-4 border-l-red-400' :
    status === 'expiring' ? 'bg-amber-50/60 border-l-4 border-l-amber-400' :
    'bg-slate-50/60 border-l-4 border-l-slate-300';

  const statusLabel = (status) =>
    status === 'expired' ? 'Expired' :
    status === 'expiring' ? 'Expiring' :
    'Unknown';

  const statusBadge = (status) =>
    status === 'expired' ? 'bg-red-100 text-red-700' :
    status === 'expiring' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';

  return (
    <div className="hub-glass rounded-2xl p-4 md:p-5 mb-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-md icon-tile-glow flex-shrink-0">
            <ShieldX className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Needs Attention — Not Compliant</h3>
            <p className="text-xs text-slate-500">
              {expiredCount > 0 && <span className="text-red-600 font-semibold">{expiredCount} expired</span>}
              {expiredCount > 0 && (expiringCount > 0 || unknownCount > 0) && <span className="text-slate-400"> · </span>}
              {expiringCount > 0 && <span className="text-amber-600 font-semibold">{expiringCount} expiring</span>}
              {expiringCount > 0 && unknownCount > 0 && <span className="text-slate-400"> · </span>}
              {unknownCount > 0 && <span className="text-slate-500 font-semibold">{unknownCount} unknown</span>}
            </p>
          </div>
        </div>
        <button onClick={() => document.getElementById('sync-compliance-btn')?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg hover:brightness-110 active:scale-95 transition text-xs font-semibold shadow-sm whitespace-nowrap">
          <RefreshCw className="w-3.5 h-3.5" /> Sync Again
        </button>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {notCompliant.slice(0, 30).map(a => (
          <div key={a.id} className={`rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 ${rowStyle(a.compliance_status)}`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {a.equipment_type && <span className="text-[11px] text-emerald-700 font-medium truncate">{a.equipment_type}</span>}
                {a.serial_number && <span className="text-[11px] text-slate-400 font-mono">{a.serial_number}</span>}
                {a.compliance_expiry_date && a.compliance_status === 'expiring' && (
                  <span className="text-[11px] text-amber-700 font-medium">Expires {new Date(a.compliance_expiry_date).toLocaleDateString('en-GB')}</span>
                )}
                {a.compliance_expiry_date && a.compliance_status === 'expired' && (
                  <span className="text-[11px] text-red-700 font-medium">Expired {new Date(a.compliance_expiry_date).toLocaleDateString('en-GB')}</span>
                )}
              </div>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusBadge(a.compliance_status)}`}>
              {statusLabel(a.compliance_status)}
            </span>
          </div>
        ))}
        {notCompliant.length > 30 && (
          <p className="text-xs text-slate-400 text-center pt-1">+ {notCompliant.length - 30} more — use the filters below</p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span>Fix the item in GC Compliance Manager, then run <strong>Sync Again</strong> to mark it compliant here.</span>
        <ArrowUpRight className="w-3 h-3 ml-auto text-slate-300" />
      </div>
    </div>
  );
}