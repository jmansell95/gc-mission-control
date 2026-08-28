import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileCheck2, AlertTriangle, Clock, CheckCircle2, XCircle, Loader2,
  Upload, Search, ShieldCheck, ChevronRight, FileText,
} from 'lucide-react';

const RAMS_CATEGORIES = ['rams', 'method_statement', 'risk_assessment'];

const CATEGORY_LABELS = {
  rams: 'RAMS',
  method_statement: 'Method Statement',
  risk_assessment: 'Risk Assessment',
};

export default function RAMSManager({ onSelectJob }) {
  const [filter, setFilter] = useState('all'); // all | current | signed | unsigned | expired
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['rams-documents'],
    queryFn: () => base44.entities.JobDocument.list('-created_date', 500),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-rams'], queryFn: () => base44.entities.Job.list() });

  const ramsDocs = useMemo(() => docs.filter(d => RAMS_CATEGORIES.includes(d.category)), [docs]);

  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = useMemo(() => ramsDocs.map(d => {
    const job = jobById[d.job_id];
    const isCurrent = d.is_current_version !== false;
    const isSigned = !!d.signed_off_at;
    const isExpired = d.valid_until && d.valid_until < today;
    const isExpiring = d.valid_until && d.valid_until >= today && d.valid_until <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    return { ...d, job, isCurrent, isSigned, isExpired, isExpiring };
  }), [ramsDocs, jobById, today]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'current') list = list.filter(d => d.isCurrent);
    else if (filter === 'signed') list = list.filter(d => d.isSigned);
    else if (filter === 'unsigned') list = list.filter(d => !d.isSigned && d.isCurrent);
    else if (filter === 'expired') list = list.filter(d => d.isExpired || d.isExpiring);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.document_name || '').toLowerCase().includes(q) ||
        (d.job?.name || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0) || (b.version || 1) - (a.version || 1));
  }, [enriched, filter, search]);

  const stats = {
    total: ramsDocs.filter(d => d.is_current_version !== false).length,
    signed: ramsDocs.filter(d => d.signed_off_at && d.is_current_version !== false).length,
    unsigned: ramsDocs.filter(d => !d.signed_off_at && d.is_current_version !== false).length,
    expired: ramsDocs.filter(d => d.valid_until && d.valid_until < today && d.is_current_version !== false).length,
  };

  const handleSignOff = async (doc) => {
    if (!confirm(`Sign off "${doc.document_name}" as approved for use?`)) return;
    try {
      await base44.entities.JobDocument.update(doc.id, {
        signed_off_at: new Date().toISOString(),
        signed_off_by: 'Manager',
      });
      queryClient.invalidateQueries({ queryKey: ['rams-documents'] });
    } catch (e) { alert('Could not sign off: ' + e.message); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500 uppercase">Current</p>
          <p className="text-xl font-bold text-slate-700 tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <p className="text-[10px] font-medium text-emerald-600 uppercase">Signed Off</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{stats.signed}</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[10px] font-medium text-amber-600 uppercase">Unsigned</p>
          <p className="text-xl font-bold text-amber-700 tabular-nums">{stats.unsigned}</p>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
          <p className="text-[10px] font-medium text-rose-600 uppercase">Expired</p>
          <p className="text-xl font-bold text-rose-700 tabular-nums">{stats.expired}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document name or job..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'current', 'signed', 'unsigned', 'expired'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-full transition capitalize whitespace-nowrap ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileCheck2 className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No RAMS documents found</p>
          <p className="text-xs text-slate-400 mt-0.5">Upload RAMS, method statements, or risk assessments from a job's Documents tab</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${d.isExpired ? 'bg-rose-50/60 border-rose-200' : d.isExpiring ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200'}`}>
              {/* Category icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${d.isSigned ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {d.isSigned ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.document_name}</p>
                  {!d.isCurrent && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">v{d.version} (old)</span>}
                  {d.isCurrent && d.version > 1 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">v{d.version}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{CATEGORY_LABELS[d.category] || d.category}</span>
                  {d.job?.name && <span className="text-xs text-slate-500 truncate">· {d.job.name}</span>}
                  {d.valid_until && (
                    <span className={`text-[10px] font-medium ${d.isExpired ? 'text-rose-600' : d.isExpiring ? 'text-amber-600' : 'text-slate-400'}`}>
                      · valid until {new Date(d.valid_until).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {d.isSigned ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Signed</span>
                ) : d.isCurrent ? (
                  <button onClick={() => handleSignOff(d)} className="text-[10px] font-bold bg-[#2E5A1A] text-white px-2.5 py-1 rounded-full hover:bg-[#1c4a12] transition">
                    Sign Off
                  </button>
                ) : null}
                <a href={d.document_url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                  <FileText className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}