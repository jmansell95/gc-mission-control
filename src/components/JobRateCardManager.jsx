import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Upload, Loader2, Briefcase, Check, X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const CATEGORY_META = {
  labour: { label: 'Labour', color: 'emerald' },
  plant: { label: 'Plant Hire', color: 'blue' },
  materials: { label: 'Materials', color: 'amber' },
};

/**
 * Job Rate Cards manager — lets an admin upload a job-specific rate card
 * (e.g. a particular project's "Application for Payment" workbook) and view the
 * ingested rates. The linked job bills against these rates in preference to the
 * global Master Price List.
 */
export default function JobRateCardManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('labour');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date', 500) });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rate-card-items'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 1000),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rate-card-items'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  // Jobs that have at least one job-scoped rate card item
  const jobsWithItems = useMemo(() => {
    const ids = new Set(items.filter((i) => i.job_id).map((i) => i.job_id));
    return jobs.filter((j) => ids.has(j.id));
  }, [items, jobs]);

  // Auto-select the first job with items on load
  const effectiveJobId = selectedJobId || jobsWithItems[0]?.id || null;
  const selectedJob = jobs.find((j) => j.id === effectiveJobId);

  const jobItems = useMemo(
    () => items.filter((i) => i.job_id === effectiveJobId),
    [items, effectiveJobId]
  );

  const counts = useMemo(() => ({
    labour: jobItems.filter((i) => i.category === 'labour').length,
    plant: jobItems.filter((i) => i.category === 'plant').length,
    materials: jobItems.filter((i) => i.category === 'materials').length,
  }), [jobItems]);

  const filtered = useMemo(() => {
    let list = jobItems.filter((i) => i.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.subcategory || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [jobItems, activeCategory, query]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const key = i.subcategory || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return Object.entries(map);
  }, [filtered]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!effectiveJobId) {
      toast({ title: 'Select a job first', description: 'Pick a job to attach this rate card to.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('processEWRRateCardUpload', {
        file_url: uploadRes.file_url,
        job_id: effectiveJobId,
      });
      toast({
        title: 'Job rate card ingested',
        description: `${res.data.ingested} rates loaded for ${res.data.job}.`,
      });
      refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Could not process file';
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Briefcase className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-slate-900">Job Rate Cards</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {effectiveJobId ? `${jobItems.length} rates` : 'No job selected'}
        </span>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !effectiveJobId}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Processing...' : 'Upload Job Rate Card'}
        </button>
      </div>

      {/* Job selector */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={effectiveJobId || ''}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
          >
            <option value="">Select a job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}{j.job_reference ? ` (${j.job_reference})` : ''}
                {jobItems.some((i) => i.job_id === j.id) ? ' — has rate card' : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedJob?.notes && (
          <p className="text-xs text-slate-400 max-w-md truncate" title={selectedJob.notes}>{selectedJob.notes}</p>
        )}
      </div>

      {!effectiveJobId ? (
        <div className="text-center py-16 px-4">
          <Briefcase className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No job rate card selected</p>
          <p className="text-xs text-slate-400 mt-1">Pick a job above, then upload its rate card workbook. That job will bill against these rates automatically.</p>
        </div>
      ) : jobItems.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Upload className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No rates ingested for this job yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Upload Job Rate Card" to load the schedule of rates for {selectedJob?.name}.</p>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-1 px-3 pt-3 border-b border-slate-100">
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const active = activeCategory === key;
              return (
                <button key={key} onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${active ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {meta.label}
                  <span className="text-xs text-slate-400">({counts[key]})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${CATEGORY_META[activeCategory].label.toLowerCase()} rates for ${selectedJob?.name || 'this job'}…`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[55vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : grouped.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400">No rates found for this category.</div>
            ) : (
              grouped.map(([subcategory, subItems]) => (
                <div key={subcategory} className="border-b border-slate-100 last:border-0">
                  <div className="px-4 py-2 bg-slate-50/80 sticky top-0 z-10">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{subcategory}</p>
                  </div>
                  {subItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition border-t border-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.description}</p>
                        {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.unit && <span className="text-xs text-slate-400">/{item.unit}</span>}
                        <span className={`text-sm font-semibold tabular-nums ${item.price != null ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                          {item.price != null ? fmt(item.price) : (item.price_text || '—')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}