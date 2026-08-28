import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isSameWeek } from 'date-fns';
import { Trophy, Star, Crown, TrendingUp, Ruler, Compass, Award, Loader2 } from 'lucide-react';
import { TIER_STYLES, BADGE_DEFINITIONS, getBadgeDef, getBadgeProgress } from '@/utils/incentiveBadges';
import { Skeleton } from '@/components/StateViews';

const ICON_MAP = { Trophy, Star, Crown, TrendingUp, Ruler, Compass, Award };

function BadgeIcon({ name, className }) {
  const Cmp = ICON_MAP[name] || Award;
  return <Cmp className={className} />;
}

/**
 * AchievementHistory — chronological timeline of all badges earned by a
 * staff member, grouped by week. Shows lifetime milestone progress bars
 * (e.g. 500m / 1,000m drilled) so crew can see how far they are from the
 * next permanent badge.
 */
export default function AchievementHistory({ staffId }) {
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievement-history', staffId],
    queryFn: () => base44.entities.Achievement.filter({ staff_id: staffId }, '-awarded_at', 500),
    enabled: !!staffId,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['achievement-history-scores', staffId],
    queryFn: () => base44.entities.IncentiveScore.filter({ staff_id: staffId }, '-week_start', 200),
    enabled: !!staffId,
  });

  // Latest score for lifetime progress bars
  const latestScore = scores[0] || null;

  // Group achievements by week_start
  const weekGroups = useMemo(() => {
    const groups = {};
    achievements.forEach(a => {
      const key = a.week_start || (a.awarded_at ? format(parseISO(a.awarded_at), 'yyyy-MM-dd') : 'unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([week, items]) => ({
        week,
        items: items.sort((a, b) => new Date(b.awarded_at || 0) - new Date(a.awarded_at || 0)),
        lifetime: items.filter(a => a.is_lifetime),
        weekly: items.filter(a => !a.is_lifetime),
      }));
  }, [achievements]);

  // Lifetime milestone badges with progress
  const lifetimeMilestones = useMemo(() => {
    return BADGE_DEFINITIONS
      .filter(b => b.is_lifetime)
      .map(badge => {
        const earned = achievements.find(a => a.badge_key === badge.key);
        const progress = latestScore ? getBadgeProgress(badge, latestScore) : null;
        return { badge, earned: !!earned, achievement: earned, progress };
      });
  }, [achievements, latestScore]);

  // Stats
  const totalBadges = achievements.length;
  const lifetimeCount = achievements.filter(a => a.is_lifetime).length;
  const weeklyCount = totalBadges - lifetimeCount;
  const bestWeek = weekGroups.length > 0 ? weekGroups.reduce((best, g) => g.items.length > best.items.length ? g : best) : null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900">Achievement History</h3>
        </div>
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  if (totalBadges === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No achievements yet</p>
        <p className="text-xs text-slate-400 mt-1">Badges you earn will appear here as a timeline of your progress.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Achievement History</h3>
          <p className="text-xs text-slate-400">{totalBadges} badges earned · {lifetimeCount} lifetime · {weeklyCount} weekly</p>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-5">
        {/* Lifetime milestone progress bars */}
        {lifetimeMilestones.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" /> Lifetime Milestones
            </h4>
            <div className="space-y-2.5">
              {lifetimeMilestones.map(({ badge, earned, achievement, progress }) => {
                const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
                const pct = earned ? 100 : (progress?.pct || 0);
                return (
                  <div key={badge.key} className={`rounded-xl border p-3 ${earned ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-lg ${tier.bg} border-2 ${tier.border} flex items-center justify-center flex-shrink-0 ${earned ? '' : 'opacity-50 grayscale'}`}>
                        <BadgeIcon name={badge.icon} className={`w-4 h-4 ${tier.text}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">{badge.name}</p>
                          {earned && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                              {achievement?.awarded_at ? format(parseISO(achievement.awarded_at), 'dd MMM yy') : 'Earned'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{badge.description}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${earned ? 'text-amber-600' : 'text-slate-400'}`}>
                        {earned ? '✓' : `${pct}%`}
                      </span>
                    </div>
                    {!earned && progress && (
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tier.hex}, ${tier.hex}dd)` }}
                        />
                      </div>
                    )}
                    {!earned && progress && (
                      <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                        {progress.display || progress.current} / {progress.target} {badge.metric === 'all_time_metres' ? 'metres' : badge.metric === 'all_time_boreholes' ? 'boreholes' : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Best week callout */}
        {bestWeek && bestWeek.items.length >= 2 && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200">
            <Star className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <p className="text-xs text-violet-800">
              <span className="font-bold">Best week:</span> {format(parseISO(bestWeek.week + 'T00:00:00'), 'dd MMM yyyy')} — {bestWeek.items.length} badges earned
            </p>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Timeline</h4>
          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200" />

            {weekGroups.map((group, gi) => (
              <div key={group.week} className="relative mb-5 last:mb-0">
                {/* Week dot */}
                <div className="absolute -left-3.5 top-1 w-3 h-3 rounded-full bg-[#2E5A1A] ring-2 ring-white shadow-sm" />

                {/* Week header */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-bold text-slate-700">
                    {group.week === 'unknown' ? 'Lifetime' : format(parseISO(group.week + 'T00:00:00'), 'dd MMM yyyy')}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {group.items.length} badge{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Badges earned this week */}
                <div className="flex flex-wrap gap-2">
                  {group.items.map((a, i) => {
                    const def = getBadgeDef(a.badge_key) || { icon: a.badge_icon, name: a.badge_name, tier: a.badge_tier, category: a.badge_category };
                    const tier = TIER_STYLES[def.tier] || TIER_STYLES.bronze;
                    return (
                      <div
                        key={a.id || i}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${tier.border} ${tier.bg}`}
                      >
                        <BadgeIcon name={def.icon} className={`w-3.5 h-3.5 ${tier.text}`} />
                        <span className="text-xs font-semibold text-slate-700">{def.name || a.badge_name}</span>
                        {a.is_lifetime && (
                          <span className="text-[8px] font-bold uppercase text-amber-600">★</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}