import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, RefreshCw, Ruler, Clock, Calendar, ShieldCheck, ClipboardCheck, Compass, Sunrise, Star, Trophy } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import { EarnedBadgeRow, BadgeCollection, CategoryFilter } from '@/components/staff/AchievementBadges';
import BadgeDetailModal from '@/components/staff/BadgeDetailModal';
import { Skeleton } from '@/components/StateViews';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function StaffProgressModal({ staffId, staffName, teamId, weekStart, onClose }) {
  const queryClient = useQueryClient();
  const [badgeCategory, setBadgeCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeDetail, setBadgeDetail] = useState(null);

  const ws = weekStart || getWeekStart();

  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ['incentive-score', staffId, ws],
    queryFn: async () => {
      const scores = await base44.entities.IncentiveScore.filter({ staff_id: staffId, week_start: ws }, '-total_points', 5);
      return scores[0] || null;
    },
    enabled: !!staffId,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', staffId],
    queryFn: () => base44.entities.Achievement.filter({ staff_id: staffId }, '-awarded_at', 200),
    enabled: !!staffId,
  });

  const { data: staffRecord } = useQuery({
    queryKey: ['staff-record', staffId],
    queryFn: () => base44.entities.Staff.get(staffId),
    enabled: !!staffId,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('calculateWeeklyIncentives', { staff_id: staffId, week_start: ws });
      queryClient.invalidateQueries({ queryKey: ['incentive-score', staffId, ws] });
      queryClient.invalidateQueries({ queryKey: ['achievements', staffId] });
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  };

  const weekBadges = achievements.filter(a => a.week_start === ws);
  const lifetimeBadges = achievements.filter(a => a.is_lifetime);
  const earnedKeys = new Set(achievements.map(a => a.badge_key));

  const metrics = score ? [
    { label: 'Metres Drilled', value: `${(score.total_metres || 0).toFixed(1)}m`, icon: Ruler, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Hours Worked', value: `${score.total_hours || 0}h`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Days Worked', value: score.days_worked || 0, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'On-Time Days', value: score.on_time_arrivals || 0, icon: Sunrise, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Safety Logs', value: score.safety_logs_submitted || 0, icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Vehicle Checks', value: score.vehicle_checks_completed || 0, icon: ClipboardCheck, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Boreholes', value: score.boreholes_worked || 0, icon: Compass, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Points', value: score.total_points || 0, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
  ] : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-slate-50 w-full min-h-full sm:min-h-0 sm:max-w-lg sm:max-h-[92vh] sm:rounded-3xl sm:shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hero-gradient relative overflow-hidden sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="relative px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <ProfileAvatar name={staffName} avatarUrl={staffRecord?.avatar_url} size={44} />
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">{staffName}</h2>
                  <p className="text-emerald-100 text-xs">Week of {format(new Date(ws + 'T00:00:00'), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/80 hover:bg-white/15 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            {score && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Trophy className="w-4 h-4 text-yellow-300" />
                  <span className="text-white text-sm font-bold tabular-nums">{score.total_points || 0} pts</span>
                </div>
                {score.rank_in_crew && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 ring-1 ring-white/20">
                    <span className="text-white text-sm font-medium">Rank #{score.rank_in_crew} in crew</span>
                  </div>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="ml-auto p-2 text-white/80 hover:bg-white/15 rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Metrics grid */}
          {scoreLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : score ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.map((m, i) => {
                const MIcon = m.icon;
                return (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                    <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center mb-2`}>
                      <MIcon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{m.value}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-slate-400 bg-white rounded-xl border border-slate-200">
              No data yet for this week. Click refresh to calculate.
            </div>
          )}

          {/* This week's badges */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              This Week's Badges
              <span className="text-xs text-slate-400 font-normal">({weekBadges.length})</span>
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <EarnedBadgeRow achievements={weekBadges} onBadgeClick={setBadgeDetail} />
            </div>
          </div>

          {/* Lifetime badges */}
          {lifetimeBadges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Lifetime Achievements
                <span className="text-xs text-slate-400 font-normal">({lifetimeBadges.length})</span>
              </h3>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <EarnedBadgeRow achievements={lifetimeBadges} max={20} onBadgeClick={setBadgeDetail} />
              </div>
            </div>
          )}

          {/* Full badge collection */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Badge Collection</h3>
            <div className="mb-3">
              <CategoryFilter active={badgeCategory} onChange={setBadgeCategory} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <BadgeCollection earnedKeys={earnedKeys} category={badgeCategory} achievements={achievements} score={score} onBadgeClick={setBadgeDetail} />
            </div>
          </div>

          {/* All-time stats */}
          {score && (score.all_time_metres > 0 || score.all_time_boreholes > 0) && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
              <h3 className="text-sm font-bold text-emerald-900 mb-2">All-Time Stats</h3>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-emerald-700 font-bold text-lg tabular-nums">{(score.all_time_metres || 0).toFixed(0)}m</span>
                  <span className="text-emerald-600 text-xs ml-1">drilled</span>
                </div>
                <div className="w-px h-8 bg-emerald-200" />
                <div>
                  <span className="text-emerald-700 font-bold text-lg tabular-nums">{score.all_time_boreholes || 0}</span>
                  <span className="text-emerald-600 text-xs ml-1">boreholes</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Badge detail modal */}
      {badgeDetail && (
        <BadgeDetailModal
          badge={badgeDetail.badge}
          achievement={badgeDetail.achievement}
          score={badgeDetail.score || score}
          onClose={() => setBadgeDetail(null)}
        />
      )}
    </div>
  );
}