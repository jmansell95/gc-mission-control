import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Drill, HardHat, Ruler, ExternalLink, BarChart3, MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

const STATE_META = {
  on_site:            { label: 'On Site',            dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  en_route:           { label: 'En Route',           dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  completed:          { label: 'Completed',          dot: 'bg-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  delivered_no_rota:  { label: 'Delivered · no rota', dot: 'bg-amber-400',  text: 'text-amber-700',   bg: 'bg-amber-50' },
  scheduled:          { label: 'Scheduled',           dot: 'bg-slate-300',   text: 'text-slate-500',   bg: 'bg-slate-100' },
  assigned:           { label: 'Assigned',            dot: 'bg-slate-200',   text: 'text-slate-400',   bg: 'bg-slate-50' },
};

/**
 * AllRigsModal — full-screen popup listing every rig active today, ranked
 * by revenue earned. Each row has "View Detail" (navigates to the full
 * Asset Detail page /assets/:id) and "Run Report" (navigates to the
 * Reporting Hub with the rig pre-selected for the rig profitability report).
 */
export default function AllRigsModal({ rigs, onClose }) {
  const navigate = useNavigate();

  const sorted = [...rigs].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalMeterage = sorted.reduce((s, r) => s + (r.meterage || 0), 0);

  const handleViewDetail = (rigId) => {
    navigate(`/assets/${rigId}`);
    onClose();
  };

  const handleRunReport = (rigId) => {
    navigate(`/reports?report=rig_profitability&rigId=${rigId}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Drill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">All Rigs — Today</h2>
              <p className="text-xs text-white/70">
                {format(new Date(), 'EEE dd MMM yyyy')} · {sorted.length} rig{sorted.length !== 1 ? 's' : ''} · ranked by revenue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase font-semibold tracking-wide">Total Earned</p>
              <p className="text-lg font-bold tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
              {totalMeterage > 0 && <p className="text-[10px] text-white/70 mt-0.5">{totalMeterage.toFixed(1)}m drilled</p>}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Drill className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">No rigs deployed today</p>
            </div>
          ) : sorted.map((stat, i) => {
            const rank = i + 1;
            const meta = STATE_META[stat.state] || STATE_META.assigned;
            const isOnSite = stat.state === 'on_site';
            const isEnRoute = stat.state === 'en_route';
            const isCompleted = stat.state === 'completed';

            let subtitle = '';
            if (isOnSite && stat.shiftStart) subtitle = `On site · ${Math.floor((Date.now() - stat.shiftStart) / 3600000)}h ${Math.floor(((Date.now() - stat.shiftStart) % 3600000) / 60000)}m`;
            else if (isEnRoute) subtitle = stat.gpsDistance != null ? `En route · ${stat.gpsDistance}m from site` : 'En route to site';
            else if (isCompleted) subtitle = 'Shift complete';
            else if (stat.state === 'delivered_no_rota') subtitle = 'Delivered to site · no rig on rota';
            else if (stat.state === 'scheduled' && stat.firstAssignment?.start_time) subtitle = `Starts at ${stat.firstAssignment.start_time}`;
            else if (stat.state === 'assigned') subtitle = 'Assigned · not on site';

            return (
              <motion.div
                key={stat.rigId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition hover:shadow-sm ${
                  rank === 1 ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  rank <= 3 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {rank}
                </div>

                {/* Status dot */}
                <div className="relative flex-shrink-0">
                  <span className={`block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  {(isOnSite || isEnRoute) && (
                    <span className={`absolute inset-0 rounded-full ${meta.dot} animate-ping opacity-60`} />
                  )}
                </div>

                {/* Rig info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{stat.rig?.name || 'Unknown Rig'}</p>
                    {stat.rig?.rig_type && stat.rig.rig_type !== 'n/a' && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-200 text-slate-600 uppercase flex-shrink-0">{stat.rig.rig_type}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 truncate min-w-0">
                      <HardHat className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{stat.leadDriller?.name || 'No lead'}</span>
                    </span>
                    {stat.meterage > 0 && (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Ruler className="w-3 h-3 text-amber-500" />
                        <span className="tabular-nums">{stat.meterage.toFixed(1)}m</span>
                      </span>
                    )}
                    {stat.job?.name && (
                      <span className="flex items-center gap-1 truncate min-w-0">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{stat.job.name}</span>
                      </span>
                    )}
                  </div>
                  {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
                </div>

                {/* Earnings */}
                <div className="text-right flex-shrink-0 min-w-[70px]">
                  <p className={`text-sm font-bold tabular-nums leading-none ${(isOnSite || isCompleted) ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {fmtGBP(stat.revenue)}
                  </p>
                  {stat.crewDayRate > 0 && <p className="text-[9px] text-slate-400 mt-0.5">/ {fmtGBP(stat.crewDayRate)} day</p>}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleViewDetail(stat.rigId)}
                    className="px-2.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Detail
                  </button>
                  <button
                    onClick={() => handleRunReport(stat.rigId)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1"
                  >
                    <BarChart3 className="w-3 h-3" />
                    Report
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-400">
            <strong>Detail</strong> opens the full asset page · <strong>Report</strong> opens rig profitability
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}