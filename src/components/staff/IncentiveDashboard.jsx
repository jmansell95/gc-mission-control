import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, RefreshCw, ChevronRight, Ruler, Clock, Calendar, ShieldCheck, ClipboardCheck, Compass, Sunrise, Star, Crown } from 'lucide-react';
import { format } from 'date-fns';
import CrewLeaderboard from '@/components/staff/CrewLeaderboard';
import { EarnedBadgeRow, BadgeCollection, CategoryFilter } from '@/components/staff/AchievementBadges';
import StaffProgressModal from '@/components/staff/StaffProgressModal';
import BadgeDetailModal from '@/components/staff/BadgeDetailModal';
import AchievementHistory from '@/components/staff/AchievementHistory';
import { Skeleton } from '@/components/StateViews';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function IncentiveDashboard({ staffId, staffName, teamId }) {
  const queryClient = useQueryClient();
  const [badgeCategory, setBadgeCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [badgeDetail, setBadgeDetail] = useState(null);
  const weekStart = getWeekStart();

  // Auto-calculate on first load if no score exists yet
  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ['incentive-score', staffId, weekStart],
    queryFn: async () => {
      const scores = await base44.entities.IncentiveScore.filter({ staff_id: staffId, week_start: weekStart }, '-total_points', 5);
      return scores[0] || null;
    },
    enabled: !!staffId,
  });

  const { data: achievements = [], isLoading: achLoading } = useQuery({
    queryKey: ['achievements', staffId],
    queryFn: () => base44.entities.Achievement.filter({ staff_id: staffId }, '-awarded_at', 200),
    enabled: !!staffId,
  });

  // Auto-trigger calculation if no score exists
  useEffect(() => {
    if (!scoreLoading && !score && staffId && !refreshing) {
      handleRefresh();
    }
  }, [scoreLoading, score, staffId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('calculateWeeklyIncentives', { staff_id: staffId, week_start: weekStart });
      queryClient.invalidateQueries({ queryKey: ['incentive-score', staffId, weekStart] });
      queryClient.invalidateQueries({ queryKey: ['achievements', staffId] });
      queryClient.invalidateQueries({ queryKey: ['incentive-scores', teamId, weekStart] });
    } catch (e) {
      console.error('Refresh failed:', e);
    }
    setRefreshing(false);
  };

  const weekBadges = achievements.filter(a => a.week_start === weekStart);
  const lifetimeBadges = achievements.filter(a => a.is_lifetime);
  const earnedKeys = new Set(achievements.map(a => a.badge_key));

  const metrics = score ? [
    { label: 'Metres', value: `${(score.total_metres || 0).toFixed(1)}m`, icon: Ruler, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Hours', value: `${score.total_hours || 0}h`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Days', value: score.days_worked || 0, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'On-Time', value: score.on_time_arrivals || 0, icon: Sunrise, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Safety', value: score.safety_logs_submitted || 0, icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Checks', value: score.vehicle_checks_completed || 0, icon: ClipboardCheck, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Boreholes', value: score.boreholes_worked || 0, icon: Compass, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Points', value: score.total_points || 0, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
  ] : [];

  return (
    <>
      <div className="insight-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="hero-gradient relative overflow-hidden px-4 md:px-6 py-4">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-yellow-300/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-yellow-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Incentives & Achievements</h2>
                <p className="text-emerald-100 text-xs">Week of {format(new Date(weekStart + 'T00:00:00'), 'dd MMM yyyy')}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white transition disabled:opacity-50 touch-manipulation active:scale-95 flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {score && (
            <div className="relative flex items-center gap-2 mt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 ring-1 ring-white/20">
                <Star className="w-4 h-4 text-yellow-300" />
                <span className="text-white text-sm font-bold tabular-nums">{score.total_points || 0} pts</span>
              </div>
              {score.rank_in_crew && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 ring-1 ring-white/20">
                  {score.rank_in_crew === 1 ? <Crown className="w-4 h-4 text-yellow-300" /> : null}
                  <span className="text-white text-sm font-medium">#{score.rank_in_crew} in crew</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 space-y-5">
          {/* Metrics grid */}
          {scoreLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : score ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.map((m, i) => {
                const MIcon = m.icon;
                return (
                  <div key={i} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
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
            <div className="text-center py-6 text-sm text-slate-400">
              {refreshing ? 'Calculating your score…' : 'No data yet — click refresh to calculate.'}
            </div>
          )}

          {/* This week's badges */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              This Week's Badges
              <span className="text-xs text-slate-400 font-normal">({weekBadges.length})</span>
            </h3>
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
              <EarnedBadgeRow achievements={weekBadges} onBadgeClick={setBadgeDetail} />
            </div>
          </div>

          {/* Crew leaderboard toggle */}
          {teamId && (
            <div>
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  Crew Leaderboard
                </h3>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showLeaderboard ? 'rotate-90' : ''}`} />
              </button>
              {showLeaderboard && (
                <CrewLeaderboard
                  teamId={teamId}
                  currentStaffId={staffId}
                  weekStart={weekStart}
                  onSelectMember={(id, name) => setSelectedMember({ staffId: id, staffName: name })}
                />
              )}
            </div>
          )}

          {/* Lifetime achievements */}
          {lifetimeBadges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Lifetime Achievements
                <span className="text-xs text-slate-400 font-normal">({lifetimeBadges.length})</span>
              </h3>
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
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
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
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

      {/* Achievement history timeline */}
      <AchievementHistory staffId={staffId} />

      {/* Staff progress modal — for viewing other crew members */}
      {selectedMember && (
        <StaffProgressModal
          staffId={selectedMember.staffId}
          staffName={selectedMember.staffName}
          teamId={teamId}
          weekStart={weekStart}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Badge detail modal */}
      {badgeDetail && (
        <BadgeDetailModal
          badge={badgeDetail.badge}
          achievement={badgeDetail.achievement}
          score={badgeDetail.score || score}
          onClose={() => setBadgeDetail(null)}
        />
      )}
    </>
  );
}