import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Star, Crown, ChevronRight, TrendingUp } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Compact mini-card for the StaffDashboard "Today" tab.
// Shows the crew member's current week incentive points and crew rank at a
// glance, with a tap-through to the full IncentiveDashboard on their profile.
export default function IncentiveQuickLook({ staffId, teamId }) {
  const navigate = useNavigate();
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: score, isLoading } = useQuery({
    queryKey: ['incentive-quick-look', staffId, weekStart],
    queryFn: async () => {
      const scores = await base44.entities.IncentiveScore.filter({ staff_id: staffId, week_start: weekStart }, '-total_points', 1);
      return scores[0] || null;
    },
    enabled: !!staffId,
  });

  if (!staffId) return null;

  if (isLoading) {
    return (
      <div className="field-card p-4 animate-pulse">
        <div className="h-16 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // Don't render if no score exists yet (the IncentiveDashboard auto-calculates
  // on first visit to the profile — no need to show a blank stub here)
  if (!score) return null;

  const points = score.total_points || 0;
  const rank = score.rank_in_crew;
  const metres = (score.total_metres || 0).toFixed(1);
  const isTop = rank === 1;

  return (
    <button
      onClick={() => navigate('/staff-profile')}
      className="field-card w-full p-4 text-left group transition hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        {/* Trophy icon tile */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${isTop ? 'stat-gradient-amber' : 'stat-gradient-emerald'}`}>
          {isTop ? <Crown className="w-6 h-6 text-white" /> : <Trophy className="w-6 h-6 text-white" />}
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-slate-900">This Week's Score</h3>
            <span className="text-[10px] text-slate-400 font-medium">{format(new Date(weekStart + 'T00:00:00'), 'dd MMM')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-slate-800 tabular-nums">{points}</span>
              <span className="text-slate-400 text-xs">pts</span>
            </span>
            {rank && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-bold text-slate-800 tabular-nums">#{rank}</span>
                <span className="text-slate-400 text-xs">in crew</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="font-bold text-slate-800 tabular-nums">{metres}m</span>
              <span className="text-slate-400 text-xs">drilled</span>
            </span>
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
      </div>
    </button>
  );
}