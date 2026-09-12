import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText, Loader2, ChevronDown, FileCheck, FileBarChart,
  ShieldCheck, FlaskConical, Download,
} from 'lucide-react';

const PACK_TYPES = [
  { key: 'full_auditor_pack', label: 'Full Auditor Pack', icon: ShieldCheck, desc: 'Complete ISO audit trail — all sections' },
  { key: 'client_progress', label: 'Client Progress Report', icon: FileCheck, desc: 'Client-facing summary — progress, schedule, photos' },
  { key: 'billing_export', label: 'Billing Export', icon: FileBarChart, desc: 'Commercial/invoice pack — costs, deliveries, meterage' },
  { key: 'geotechnical_report', label: 'Geotechnical Report', icon: FlaskConical, desc: 'Technical — borehole logs, lab results, samples' },
  { key: 'compliance_pack', label: 'Compliance Pack', icon: ShieldCheck, desc: 'Compliance certificates & sign-offs only' },
];

export default function GeneratePackButton({ job, clientName }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [generating, setGenerating] = useState(null);
  const queryClient = useQueryClient();

  const handleGenerate = async (packType) => {
    setGenerating(packType);
    setShowDropdown(false);
    try {
      const res = await base44.functions.invoke('generateJobPack', {
        jobId: job.id,
        packType,
        generatedByName: 'Admin',
      });
      const data = res.data || {};
      if (data.ok && data.html) {
        // Open the HTML in a new window for printing to PDF
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(data.html);
          printWin.document.close();
          setTimeout(() => {
            printWin.focus();
            printWin.print();
          }, 500);
        }
        // Invalidate JobPack queries to refresh the pack list
        queryClient.invalidateQueries({ queryKey: ['job-packs', job.id] });
      }
    } catch (e) {
      console.error('Generate pack error:', e);
      alert('Failed to generate pack: ' + (e.message || 'Unknown error'));
    }
    setGenerating(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={generating !== null}
        className="flex items-center gap-2 px-3.5 py-2 text-white rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
        style={{ background: '#2E5A1A' }}
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {generating ? 'Generating…' : 'Generate ISO Pack'}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700">Select Pack Type</p>
            </div>
            {PACK_TYPES.map(pt => {
              const Icon = pt.icon;
              const isGenerating = generating === pt.key;
              return (
                <button
                  key={pt.key}
                  onClick={() => handleGenerate(pt.key)}
                  disabled={generating !== null}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    {isGenerating ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Icon className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{pt.label}</p>
                    <p className="text-[10px] text-slate-500">{pt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}