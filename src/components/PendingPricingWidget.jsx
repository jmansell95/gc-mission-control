import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileCheck, FileText, PoundSterling, ChevronRight } from 'lucide-react';
import ConfirmQuoteModal from '@/components/equipment/ConfirmQuoteModal';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Consolidated "Needs Attention" widget shown on the Financials tab.
 * Lists every job cost item flagged as POA (Price on Application) that
 * hasn't had a confirmed price set yet — so the Contracts Manager can
 * see everything requiring pricing in one place instead of scrolling
 * through every equipment card in the Logistics tab.
 */
export default function PendingPricingWidget({ jobId }) {
  const queryClient = useQueryClient();
  const [confirmingItem, setConfirmingItem] = useState(null);

  const { data: items = [] } = useQuery({
    queryKey: ['job-cost-items', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const pendingItems = items.filter((c) => c.is_poa && !c.price_confirmed);
  const confirmedItems = items.filter((c) => c.price_confirmed && c.negotiated_unit_cost != null);

  if (pendingItems.length === 0 && confirmedItems.length === 0) return null;

  const pendingValue = pendingItems.reduce((s, c) => s + (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1), 0);

  return (
    <div className="space-y-3">
      {/* Pending POA items — needs attention */}
      {pendingItems.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 overflow-hidden">
          <div className="px-4 py-3 bg-amber-100/80 border-b border-amber-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-900">Pending Pricing — {pendingItems.length} item{pendingItems.length === 1 ? '' : 's'} awaiting agreed price</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                These items were added as "Price on Application". Once the contract is agreed, confirm each price so billing reflects the correct amount.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
              {pendingItems.length} to confirm
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingItems.map((c) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 bg-white/50">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <PoundSterling className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    {c.quantity || 1} {c.unit_label || 'unit'}{(c.quantity || 1) > 1 ? 's' : ''}
                    {c.reference_number && ` · Ref: ${c.reference_number}`}
                    {c.po_number && ` · PO: ${c.po_number}`}
                    {' · No price set'}
                  </p>
                </div>
                <button
                  onClick={() => setConfirmingItem(c)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition flex-shrink-0 whitespace-nowrap"
                >
                  <FileCheck className="w-3.5 h-3.5" /> Confirm Price
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed items — audit trail */}
      {confirmedItems.length > 0 && (
        <details className="rounded-xl border border-primary/20 bg-primary/10 overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-primary/10 transition">
            <FileCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {confirmedItems.length} confirmed price{confirmedItems.length === 1 ? '' : 's'}
            </span>
            <ChevronRight className="w-4 h-4 text-primary/70 ml-auto" />
          </summary>
          <div className="divide-y divide-[#2E5A1A]/20 border-t border-primary/20">
            {confirmedItems.map((c) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    {fmt(Number(c.negotiated_unit_cost))}/{c.unit_label || 'unit'}
                    {c.confirmed_by_name && ` · confirmed by ${c.confirmed_by_name}`}
                  </p>
                </div>
                {c.quote_document_url && (
                  <a
                    href={c.quote_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition flex-shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" /> Quote
                  </a>
                )}
                <button
                  onClick={() => setConfirmingItem(c)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition flex-shrink-0 whitespace-nowrap"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {confirmingItem && (
        <ConfirmQuoteModal
          item={confirmingItem}
          jobId={jobId}
          onClose={() => setConfirmingItem(null)}
        />
      )}
    </div>
  );
}