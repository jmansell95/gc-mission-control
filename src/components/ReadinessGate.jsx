import React from 'react';
import { Clock, Lock, Settings, ArrowRight } from 'lucide-react';
import { useReadiness, STATE_ACTIVE, STATE_COMING_SOON, STATE_LOCKED } from '@/hooks/useReadiness';
import { FEATURE_REGISTRY, INTEGRATIONS } from '@/utils/featureRegistry';

/**
 * ReadinessGate — wraps any content block and gates it based on the feature's
 * readiness state (active / coming_soon / locked).
 *
 * Props:
 *   featureId  — key from FEATURE_REGISTRY (e.g. 'compliance.safetyculture')
 *   children   — content to render when active
 *   onConfigure— optional callback for the "Configure" button (navigates to settings)
 *   message    — optional custom message for the coming-soon state
 *   compact    — if true, renders a compact inline banner instead of a full-page state
 */
export default function ReadinessGate({
  featureId,
  children,
  onConfigure,
  message,
  compact = false,
}) {
  const { getState } = useReadiness();
  const state = getState(featureId);
  const feature = FEATURE_REGISTRY[featureId];

  if (state === STATE_ACTIVE) {
    return <>{children}</>;
  }

  const integration = feature?.dependsOn ? INTEGRATIONS[feature.dependsOn] : null;
  const integrationLabel = integration?.label || 'an integration';

  // === LOCKED state ===
  if (state === STATE_LOCKED) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[300px]">
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
            <Lock className="w-9 h-9 text-slate-400" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-slate-700">{feature?.label || 'This feature'} is Locked</h3>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
          This section has been locked by an administrator. Toggle it back on in Settings → Readiness Manager.
        </p>
        {onConfigure && (
          <button onClick={onConfigure} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition">
            <Settings className="w-4 h-4" /> Manage in Settings
          </button>
        )}
      </div>
    );
  }

  // === COMING SOON state ===
  if (compact) {
    return (
      <div className="insight-card rounded-xl p-4 flex items-center gap-3 bg-amber-50/60 border-amber-200">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{feature?.label || 'This feature'} — Coming Soon</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {message || `Waiting for ${integrationLabel} to be configured. Data will appear here automatically once connected.`}
          </p>
        </div>
        {onConfigure && (
          <button onClick={onConfigure} className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition">
            Configure <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Amber coming-soon banner */}
      <div className="insight-card rounded-2xl p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{feature?.label || 'This feature'} — Coming Soon</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {message || `This section is waiting for ${integrationLabel} to be configured. Once the integration is connected, data will appear here automatically.`}
          </p>
        </div>
        {onConfigure && (
          <button
            onClick={onConfigure}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition flex-shrink-0"
          >
            <Settings className="w-3.5 h-3.5" /> Configure
          </button>
        )}
      </div>

      {/* No data placeholder */}
      <div className="insight-card rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">No data available yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {message || `This section will populate automatically once ${integrationLabel} is connected and syncing.`}
        </p>
        {onConfigure && (
          <button onClick={onConfigure} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition">
            <Settings className="w-4 h-4" /> Go to Settings
          </button>
        )}
      </div>
    </div>
  );
}

// Re-export states for convenience
export { STATE_ACTIVE, STATE_COMING_SOON, STATE_LOCKED };