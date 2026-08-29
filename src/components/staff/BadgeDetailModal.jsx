import React from 'react';
import {
  X, Lock, CheckCircle2, Calendar, TrendingUp, Award,
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { TIER_STYLES, CATEGORY_STYLES, getBadgeProgress } from '@/utils/incentiveBadges';

const ICON_MAP = {
  Drill, Ruler, Trophy, Compass, Sunrise, CalendarCheck, Clock,
  ShieldCheck, ClipboardCheck, Anchor, Medal, Star, Zap, Award,
};

/**
 * Detail modal shown when a badge is tapped.
 * Shows: badge icon, name, tier, category, description, how-to-earn criteria,
 * earned date (if earned), or live progress bar (if locked).
 */
export default function BadgeDetailModal({ badge, achievement, score, onClose }) {
  if (!badge) return null;

  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const cat = CATEGORY_STYLES[badge.category] || CATEGORY_STYLES.special;
  const Icon = ICON_MAP[badge.icon] || Award;
  const isEarned = !!achievement;
  const progress = !isEarned ? getBadgeProgress(badge, score) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-md sm:max-h-[90vh] sm:rounded-3xl sm:shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Hero header with badge icon */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${tier.gradient} px-5 pt-6 pb-5`}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <button onClick={onClose} className="absolute top-3 right-3 p-2 text-white/80 hover:bg-white/20 rounded-lg transition z-10">
            <X className="w-5 h-5" />
          </button>
          <div className="relative flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-2xl bg-white/25 backdrop-blur-sm ring-2 ring-white/30 flex items-center justify-center mb-3 ${!isEarned ? 'opacity-60' : ''}`}>
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-bold text-xl leading-tight">{badge.name}</h2>
              {isEarned ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <Lock className="w-4 h-4 text-white/70" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 px-2 py-0.5 rounded-full bg-white/20">
                {tier.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 px-2 py-0.5 rounded-full bg-white/20">
                {cat.label}
              </span>
              {badge.is_lifetime && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 px-2 py-0.5 rounded-full bg-white/20">
                  Lifetime
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status banner */}
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isEarned ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
            {isEarned ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Badge Earned!</p>
                  {achievement?.awarded_at && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(achievement.awarded_at), 'dd MMM yyyy · HH:mm')}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Not Earned Yet</p>
                  <p className="text-xs text-slate-500">Keep working to unlock this badge.</p>
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Description</h3>
            <p className="text-sm text-slate-700">{badge.description}</p>
          </div>

          {/* How to earn */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">How to Earn</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{badge.criteria}</p>
          </div>

          {/* Progress (locked badges only) */}
          {!isEarned && progress && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your Progress This Week</h3>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {progress.display}
                    <span className="text-slate-400 font-normal"> / {badge.invertProgress ? `Top ${badge.threshold}` : badge.threshold}</span>
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{progress.pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {progress.isComplete
                    ? 'Target met — badge will be awarded on the next calculation.'
                    : `${Math.max(0, badge.threshold - progress.current)} more to go${badge.invertProgress ? '' : ''}.`}
                </p>
              </div>
            </div>
          )}

          {/* Points value (if earned) */}
          {isEarned && achievement?.points_value > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Points Earned</h3>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span className="text-lg font-bold text-slate-900 tabular-nums">+{achievement.points_value} pts</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}