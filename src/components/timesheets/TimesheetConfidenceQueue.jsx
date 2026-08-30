import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Clock, MapPin, FileText, Truck,
  ShieldCheck, Zap, ChevronDown, ChevronUp, User, Loader2, ThumbsUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const CONFIDENCE_TIERS = {
  green: { label: 'Green Path', color: 'emerald', icon: ShieldCheck, min: 80 },
  review: { label: 'Review Needed', color: 'amber', icon: AlertTriangle, min: 40 },
  missing: { label: 'Missing Data', color: 'rose', icon: Clock, min: 0 },
};

function getTier(score) {
  if (score >= 80) return 'green';
  if (score >= 40) return 'review';
  return 'missing';
}

const SOURCE_ICONS = {
  gps: MapPin,
  keylogbook: FileText,
  delivery: Truck,
  rota: Clock,
  mitti: ShieldCheck,
};

export default function TimesheetConfidenceQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [approving, setApproving] = useState(false);
  const [filter, setFilter] = useState('all'); // all | green | review | missing

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['auto-timesheet-queue'],
    queryFn: () => base44.entities.Timesheet.filter({
      status: { $in: ['submitted', 'auto_submitted'] },
      is_summary: true,
    }, '-date', 100),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-list-queue'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const staffMap = useMemo(() => {
    const m = {};
    staff.forEach(s => { m[s.id] = s; });
    return m;
  }, [staff]);

  const sorted = useMemo(() => {
    return [...timesheets]
      .map(t => ({ ...t, _tier: getTier(t.confidence_score || 0) }))
      .filter(t => filter === 'all' || t._tier === filter)
      .sort((a, b) => (a.confidence_score || 0) < (b.confidence_score || 0) ? 1 : -1);
  }, [timesheets, filter]);

  const greenCount = timesheets.filter(t => getTier(t.confidence_score || 0) === 'green').length;
  const reviewCount = timesheets.filter(t => getTier(t.confidence_score || 0) === 'review').length;
  const missingCount = timesheets.filter(t => getTier(t.confidence_score || 0) === 'missing').length;

  const approveOne = async (id) => {
    setApproving(true);
    try {
      await base44.entities.Timesheet.update(id, {
        status: 'approved',
        approved_by_name: 'Manager',
      });
      queryClient.invalidateQueries({ queryKey: ['auto-timesheet-queue'] });
      toast({ title: 'Timesheet approved' });
    } catch (e) {
      toast({ title: 'Approval failed', variant: 'destructive' });
    }
    setApproving(false);
  };

  const approveAllGreen = async () => {
    const greenIds = sorted.filter(t => t._tier === 'green').map(t => t.id);
    if (greenIds.length === 0) return;
    setApproving(true);
    try {
      await base44.entities.Timesheet.bulkUpdate(
        greenIds.map(id => ({ id, status: 'approved', approved_by_name: 'Manager' }))
      );
      queryClient.invalidateQueries({ queryKey: ['auto-timesheet-queue'] });
      toast({ title: `${greenIds.length} timesheets approved`, description: 'All green-path entries auto-approved.' });
    } catch (e) {
      toast({ title: 'Bulk approval failed', variant: 'destructive' });
    }
    setApproving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter(filter === 'green' ? 'all' : 'green')}
          className={`rounded-2xl p-3 border text-left transition ${filter === 'green' ? 'ring-2 ring-emerald-400 bg-emerald-50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-500">Green Path</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{greenCount}</p>
          <p className="text-[10px] text-slate-400">Auto-approve eligible</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
          className={`rounded-2xl p-3 border text-left transition ${filter === 'review' ? 'ring-2 ring-amber-400 bg-amber-50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-500">Review</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{reviewCount}</p>
          <p className="text-[10px] text-slate-400">Needs your attention</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
          className={`rounded-2xl p-3 border text-left transition ${filter === 'missing' ? 'ring-2 ring-rose-400 bg-rose-50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-500">Missing</span>
          </div>
          <p className="text-2xl font-bold text-rose-700 tabular-nums">{missingCount}</p>
          <p className="text-[10px] text-slate-400">No data — nudge staff</p>
        </button>
      </div>

      {/* Approve all green */}
      {greenCount > 0 && (
        <button
          onClick={approveAllGreen}
          disabled={approving}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
        >
          {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Approve All Green Path ({greenCount})
        </button>
      )}

      {/* Queue list */}
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">All caught up — no timesheets pending.</p>
          </div>
        ) : (
          sorted.map((t) => {
            const tier = CONFIDENCE_TIERS[t._tier];
            const TierIcon = tier.icon;
            const staffName = staffMap[t.staff_id]?.name || 'Unknown';
            const isExpanded = expandedId === t.id;
            const sources = (t.auto_built_sources || '').split(',').filter(Boolean);
            const score = t.confidence_score || 0;

            return (
              <motion.div
                key={t.id}
                layout
                className={`rounded-2xl border bg-white overflow-hidden ${tier.color === 'emerald' ? 'border-emerald-200' : tier.color === 'amber' ? 'border-amber-200' : 'border-rose-200'}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full p-3 flex items-center gap-3 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tier.color === 'emerald' ? 'bg-emerald-100' : tier.color === 'amber' ? 'bg-amber-100' : 'bg-rose-100'}`}>
                    <TierIcon className={`w-5 h-5 ${tier.color === 'emerald' ? 'text-emerald-600' : tier.color === 'amber' ? 'text-amber-600' : 'text-rose-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900 truncate">{staffName}</p>
                      <span className="text-xs text-slate-400">{format(new Date(t.date), 'EEE dd MMM')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {sources.map(s => {
                        const SIcon = SOURCE_ICONS[s] || Clock;
                        return (
                          <span key={s} className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <SIcon className="w-3 h-3" /> {s}
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-slate-400 tabular-nums">{score}% confidence</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] uppercase">On-site</p>
                        <p className="font-bold text-slate-700 tabular-nums">{Math.round((t.on_site_minutes || 0) / 60 * 10) / 10}h</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] uppercase">Travel</p>
                        <p className="font-bold text-slate-700 tabular-nums">{Math.round((t.payable_travel_minutes || 0) / 60 * 10) / 10}h</p>
                      </div>
                    </div>
                    {t._tier === 'missing' && (
                      <p className="text-xs text-rose-600 mb-2">
                        No GPS or KeyLogBook data detected. Nudge the staff member to confirm their hours.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveOne(t.id)}
                        disabled={approving}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Approve
                      </button>
                      {t._tier === 'missing' && (
                        <button className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold active:scale-95 transition">
                          Nudge Staff
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}