import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileBarChart, Upload, FileText, TrendingUp, BarChart3, Receipt,
  Download, AlertCircle,
} from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import CVRSummaryHero from './CVRSummaryHero';
import CVRLineItemsTable from './CVRLineItemsTable';
import CVRVariationsTab from './CVRVariationsTab';
import CVRCashFlowChart from './CVRCashFlowChart';
import CVRUploadModal from './CVRUploadModal';
import AFPUploadModal from './AFPUploadModal';

/**
 * CVRAFPDashboard — the full job-level CVR/AFP dashboard. Shown as a new
 * sub-tab in the job's Financials tab. Contains: Summary hero, CVR line items,
 * Variations, Cash Flow chart, and AFP view. Upload buttons for CVR and AFP.
 */
export default function CVRAFPDashboard({ job }) {
  const [subTab, setSubTab] = useState('summary');
  const [showCVRUpload, setShowCVRUpload] = useState(false);
  const [showAFPUpload, setShowAFPUpload] = useState(false);

  const { data: cvrs = [] } = useQuery({
    queryKey: ['cvr', job.id],
    queryFn: () => base44.entities.CVR.filter({ job_id: job.id }),
  });
  const cvr = cvrs[0];

  const { data: lineItems = [] } = useQuery({
    queryKey: ['cvr-line-items', job.id],
    queryFn: () => base44.entities.CVRLineItem.filter({ job_id: job.id }, 'sort_order', 500),
    enabled: !!cvr,
  });

  const { data: variations = [] } = useQuery({
    queryKey: ['cvr-variations', job.id],
    queryFn: () => base44.entities.VariationOrder.filter({ job_id: job.id }, 'sort_order', 200),
    enabled: !!cvr,
  });

  const { data: cashFlow = [] } = useQuery({
    queryKey: ['cvr-cash-flow', job.id],
    queryFn: () => base44.entities.CashFlowEntry.filter({ job_id: job.id }, 'sort_order', 200),
    enabled: !!cvr,
  });

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowCVRUpload(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" /> Upload CVR
        </button>
        <button
          onClick={() => setShowAFPUpload(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" /> Upload AFP
        </button>
        {cvr?.source_file_url && (
          <a
            href={cvr.source_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" /> Original CVR
          </a>
        )}
      </div>

      {/* Empty state */}
      {!cvr && (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileBarChart className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-base font-bold text-slate-700">No CVR uploaded yet</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Upload a Cost/Value Report spreadsheet to start tracking contract value, budget, costs, variations, and profit/loss for this job.
          </p>
        </div>
      )}

      {/* Sub-tabs */}
      {cvr && (
        <SubTabNav
          tabs={[
            { id: 'summary', label: 'Summary', icon: TrendingUp },
            { id: 'line-items', label: 'Line Items', icon: BarChart3 },
            { id: 'variations', label: 'Variations', icon: FileBarChart },
            { id: 'cash-flow', label: 'Cash Flow', icon: Receipt },
          ]}
          activeTab={subTab}
          onChange={setSubTab}
        />
      )}

      {/* Content */}
      {cvr && subTab === 'summary' && <CVRSummaryHero cvr={cvr} />}
      {cvr && subTab === 'line-items' && <CVRLineItemsTable cvr={cvr} lineItems={lineItems} />}
      {cvr && subTab === 'variations' && <CVRVariationsTab cvr={cvr} variations={variations} />}
      {cvr && subTab === 'cash-flow' && <CVRCashFlowChart cashFlow={cashFlow} />}

      {/* Upload modals */}
      {showCVRUpload && <CVRUploadModal job={job} onClose={() => setShowCVRUpload(false)} />}
      {showAFPUpload && <AFPUploadModal job={job} onClose={() => setShowAFPUpload(false)} />}
    </div>
  );
}