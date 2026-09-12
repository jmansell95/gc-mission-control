import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, TrendingUp, ThumbsUp, Smile, Meh, Frown, ArrowRight, Settings } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format } from 'date-fns';

const NPS_BAND = (score) => {
  if (score == null) return null;
  if (score <= 6) return { label: 'Detractor', icon: Frown, cls: 'text-rose-600 bg-rose-50' };
  if (score <= 8) return { label: 'Passive', icon: Meh, cls: 'text-amber-600 bg-amber-50' };
  return { label: 'Promoter', icon: Smile, cls: 'text-emerald-600 bg-emerald-50' };
};

export default function ClientFeedbackWidget() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  const { data: feedback = [] } = useQuery({ queryKey: ['client-feedback'], queryFn: () => base44.entities.ClientFeedback.list('-submitted_at', 30) });

  const stats = {
    total: feedback.length,
    avgRating: feedback.length > 0 ? (feedback.reduce((s, f) => s + (f.overall_rating || 0), 0) / feedback.length).toFixed(1) : '—',
    promoters: feedback.filter(f => (f.nps_score || 0) >= 9).length,
    detractors: feedback.filter(f => (f.nps_score || 0) <= 6).length,
    passives: feedback.filter(f => (f.nps_score || 0) >= 7 && (f.nps_score || 0) <= 8).length,
    newCount: feedback.filter(f => f.status === 'new').length,
  };
  const nps = feedback.length > 0 ? Math.round(((stats.promoters - stats.detractors) / feedback.length) * 100) : 0;

  const updateStatus = async (id, status) => {
    await base44.entities.ClientFeedback.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['client-feedback'] });
  };

  return (
    <WidgetShell widgetId="client-feedback" title="Client Feedback" icon={Star} subtitle={`${stats.total} responses · ${stats.avgRating}★ avg · NPS ${nps > 0 ? '+' : ''}${nps}`}>
      <div className="space-y-3">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-50 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="text-lg font-bold text-amber-700 tabular-nums">{stats.avgRating}</span>
            </div>
            <p className="text-[10px] text-amber-600 font-medium uppercase">Avg Rating</p>
          </div>
          <div className={`rounded-lg p-2.5 text-center ${nps >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <p className={`text-lg font-bold tabular-nums ${nps >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{nps > 0 ? '+' : ''}{nps}</p>
            <p className="text-[10px] font-medium uppercase text-slate-500">NPS</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-blue-700 tabular-nums">{stats.newCount}</p>
            <p className="text-[10px] text-blue-600 font-medium uppercase">New</p>
          </div>
        </div>

        {/* NPS breakdown */}
        {feedback.length > 0 && (
          <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500" style={{ width: `${(stats.promoters / feedback.length) * 100}%` }} title={`${stats.promoters} promoters`} />
            <div className="bg-amber-400" style={{ width: `${(stats.passives / feedback.length) * 100}%` }} title={`${stats.passives} passives`} />
            <div className="bg-rose-500" style={{ width: `${(stats.detractors / feedback.length) * 100}%` }} title={`${stats.detractors} detractors`} />
          </div>
        )}

        {/* Recent feedback */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {feedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No client feedback yet</p>
              <p className="text-xs text-slate-400 mb-4 max-w-[220px]">Feedback is collected via the client portal after job completion. Enable it to start collecting NPS scores and reviews.</p>
              <button
                onClick={() => navigate('/enterprise/settings')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition border border-primary/15"
              >
                <Settings className="w-3.5 h-3.5" />
                Enable feedback on portal
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : feedback.slice(0, 8).map(f => {
            const band = NPS_BAND(f.nps_score);
            const BandIcon = band?.icon;
            return (
              <div key={f.id} className="border border-slate-200 rounded-lg p-2.5 hover:bg-slate-50/50 transition cursor-pointer" onClick={() => setSelected(selected === f.id ? null : f.id)}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{f.job_name || 'Job'}</p>
                    <p className="text-[10px] text-slate-400">{f.submitted_at ? format(new Date(f.submitted_at), 'dd MMM yyyy') : '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="flex">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`w-3 h-3 ${(f.overall_rating || 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                {band && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${band.cls}`}>
                      <BandIcon className="w-2.5 h-2.5" /> {band.label} ({f.nps_score})
                    </span>
                    {f.status === 'new' && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">New</span>}
                  </div>
                )}
                {f.feedback_text && selected === f.id && (
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed italic">"{f.feedback_text}"</p>
                )}
                {selected === f.id && (
                  <div className="flex gap-1 mt-2">
                    {f.status === 'new' && <button onClick={(e) => { e.stopPropagation(); updateStatus(f.id, 'reviewed'); }} className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded font-medium hover:bg-slate-200">Mark Reviewed</button>}
                    {f.status !== 'actioned' && <button onClick={(e) => { e.stopPropagation(); updateStatus(f.id, 'actioned'); }} className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-medium hover:bg-emerald-200">Actioned</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}