import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, X, ChevronRight, AlertTriangle } from 'lucide-react';

/**
 * RedAlertBanner — a global, site-wide banner that appears at the top of
 * every page when there are open critical-severity SafetyReports (Red Alerts
 * raised in SafetyCulture or critical incidents reported in-app).
 *
 * Dismissible per-session (localStorage tracks dismissed report IDs so the
 * banner doesn't nag, but reappears when a NEW critical alert arrives).
 */
export default function RedAlertBanner() {
  const navigate = useNavigate();
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem('red-alert-dismissed');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const { data: criticalReports = [] } = useQuery({
    queryKey: ['critical-safety-reports'],
    queryFn: () => base44.entities.SafetyReport.filter(
      { severity: 'critical', status: 'open' },
      '-created_date',
      10
    ),
    refetchInterval: 60000, // refresh every 60s so new alerts surface quickly
  });

  // Filter out dismissed alerts
  const activeAlerts = criticalReports.filter(r => !dismissedIds.has(r.id));

  if (activeAlerts.length === 0) return null;

  const dismiss = (id, e) => {
    e.stopPropagation();
    const next = new Set([...dismissedIds, id]);
    setDismissedIds(next);
    sessionStorage.setItem('red-alert-dismissed', JSON.stringify([...next]));
  };

  const dismissAll = (e) => {
    e.stopPropagation();
    const next = new Set([...dismissedIds, ...activeAlerts.map(a => a.id)]);
    setDismissedIds(next);
    sessionStorage.setItem('red-alert-dismissed', JSON.stringify([...next]));
  };

  const goToSafety = () => navigate('/compliance');

  return (
    <div className="relative z-30">
      <div
        className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-lg animate-in slide-in-from-top duration-300"
        role="alert"
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Pulsing icon */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
            <div className="relative w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Alert text — scrollable on mobile */}
          <button onClick={goToSafety} className="flex-1 min-w-0 text-left flex items-center gap-2 group">
            <div className="min-w-0">
              <p className="text-sm font-bold flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-xs font-bold">
                  {activeAlerts.length}
                </span>
                {activeAlerts.length === 1 ? 'RED ALERT ACTIVE' : `${activeAlerts.length} RED ALERTS ACTIVE`}
              </p>
              <p className="text-xs text-white/90 truncate mt-0.5 group-hover:underline">
                {activeAlerts[0]?.audit_title || activeAlerts[0]?.description || 'Critical safety alert'}
                {activeAlerts[0]?.site_name && ` · ${activeAlerts[0].site_name}`}
                {activeAlerts.length > 1 && ` · +${activeAlerts.length - 1} more`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Dismiss buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {activeAlerts.length === 1 ? (
              <button
                onClick={(e) => dismiss(activeAlerts[0].id, e)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
                title="Dismiss this alert"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={dismissAll}
                className="text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-white/20 transition whitespace-nowrap"
              >
                Dismiss all
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}