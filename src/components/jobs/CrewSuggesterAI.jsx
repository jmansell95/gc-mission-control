import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, CheckCircle2, UserPlus, X } from 'lucide-react';

// AI-powered crew suggestion panel — embedded in the Quick Assign Staff modal.
// Calls the suggestCrewAllocation backend function and shows ranked recommendations.

export default function CrewSuggesterAI({ job, assignedDate, allStaff, onApply }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);
  const [appliedIds, setAppliedIds] = useState(new Set());

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setAppliedIds(new Set());
    try {
      const res = await base44.functions.invoke('suggestCrewAllocation', {
        job_id: job.id,
        assigned_date: assignedDate,
      });
      setSuggestions(res.data?.recommendations || []);
      setSummary(res.data?.summary || '');
    } catch (err) {
      setError(err?.message || 'Could not get suggestions');
    }
    setLoading(false);
  };

  const applyOne = (staffId) => {
    onApply(staffId);
    setAppliedIds(prev => new Set([...prev, staffId]));
  };

  const applyAll = () => {
    if (!suggestions) return;
    suggestions.forEach(s => {
      if (!appliedIds.has(s.staff_id)) onApply(s.staff_id);
    });
    setAppliedIds(new Set(suggestions.map(s => s.staff_id)));
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-[#2E5A1A]/5 to-emerald-50/30 p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-slate-800">AI Crew Suggester</span>
        </div>
        {suggestions && suggestions.length > 0 && (
          <button onClick={applyAll} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Apply all
          </button>
        )}
      </div>

      {!suggestions && !loading && !error && (
        <button onClick={fetchSuggestions} className="w-full text-sm text-slate-600 hover:text-primary py-2 transition">
          Get AI recommendations for this job →
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-slate-500">Analysing crew & job requirements…</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 py-2 flex items-center gap-2">
          <X className="w-4 h-4" /> {error}
          <button onClick={fetchSuggestions} className="ml-auto text-xs text-primary hover:underline">Retry</button>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {summary && <p className="text-xs text-slate-500 italic mb-2">{summary}</p>}
          {suggestions.map((s, i) => {
            const staff = allStaff.find(p => p.id === s.staff_id);
            const isApplied = appliedIds.has(s.staff_id);
            return (
              <div key={s.staff_id} className="flex items-start gap-2.5 bg-white rounded-lg p-2.5 border border-slate-100">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.name || staff?.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.match_score >= 80 ? 'bg-emerald-100 text-emerald-700' : s.match_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {s.match_score}% match
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{s.reason}</p>
                </div>
                <button
                  onClick={() => applyOne(s.staff_id)}
                  disabled={isApplied}
                  className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                    isApplied
                      ? 'bg-emerald-100 text-emerald-600 cursor-default'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {isApplied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {isApplied ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-slate-400 py-2">No recommendations available. Try adjusting the job requirements.</p>
      )}
    </div>
  );
}