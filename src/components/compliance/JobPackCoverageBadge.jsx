import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * JobPackCoverageBadge — shows what % of the expected auditor pack
 * content is available for a job. Fetches counts in parallel and
 * calculates a weighted coverage score.
 *
 * Coverage weights:
 *  - Rota assignments (crew)   20%
 *  - Investigation logs          25%
 *  - Compliance items (staff)    20%
 *  - Site photos                 10%
 *  - Job documents               15%
 *  - Asset assignments           10%
 */
export default function JobPackCoverageBadge({ jobId, compact = false }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['jobpack-coverage', jobId],
    queryFn: async () => {
      const [rotas, logs, compliance, photos, docs, assets] = await Promise.all([
        base44.entities.RotaAssignment.filter({ job_id: jobId }, '-created_date', 1).catch(() => []),
        base44.entities.InvestigationLog.filter({ job_id: jobId }, '-created_date', 1).catch(() => []),
        base44.entities.ComplianceItem.filter({ category: 'staff', reference_id: jobId }, '-created_date', 1).catch(() => []),
        base44.entities.SitePhoto.filter({ job_id: jobId }, '-created_date', 1).catch(() => []),
        base44.entities.JobDocument.filter({ job_id: jobId }, '-created_date', 1).catch(() => []),
        base44.entities.JobAssetAssignment.filter({ job_id: jobId }, '-created_date', 1).catch(() => []),
      ]);
      return {
        rotas: rotas.length,
        logs: logs.length,
        compliance: compliance.length,
        photos: photos.length,
        docs: docs.length,
        assets: assets.length,
      };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />;
  }

  if (!data) return null;

  const checks = [
    { key: 'rotas', label: 'Crew', weight: 20, value: data.rotas },
    { key: 'logs', label: 'Site Logs', weight: 25, value: data.logs },
    { key: 'compliance', label: 'Compliance', weight: 20, value: data.compliance },
    { key: 'docs', label: 'Documents', weight: 15, value: data.docs },
    { key: 'photos', label: 'Photos', weight: 10, value: data.photos },
    { key: 'assets', label: 'Equipment', weight: 10, value: data.assets },
  ];

  const coverage = checks.reduce((sum, c) => sum + (c.value > 0 ? c.weight : 0), 0);
  const missing = checks.filter(c => c.value === 0);

  const color =
    coverage >= 80 ? 'bg-emerald-100 text-emerald-700' :
    coverage >= 50 ? 'bg-amber-100 text-amber-700' :
    coverage > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500';

  const icon = coverage >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />;

  if (compact) {
    return (
      <div className="relative" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
          {icon} {coverage}%
        </span>
        {expanded && (
          <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[180px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Pack Coverage</p>
            {checks.map(c => (
              <div key={c.key} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-slate-600">{c.label}</span>
                <span className={c.value > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{c.value > 0 ? '✓' : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
        {icon} {coverage}% coverage
      </span>
      {missing.length > 0 && coverage > 0 && (
        <span className="text-[10px] text-slate-400">
          Missing: {missing.map(m => m.label).join(', ')}
        </span>
      )}
    </div>
  );
}