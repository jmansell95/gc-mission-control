import React from 'react';
import BackButton from '@/components/BackButton';
import HubHeader from '@/components/hubs/HubHeader';
import HubQuickLinks from '@/components/hubs/HubQuickLinks';
import HubTabBar from '@/components/hubs/HubTabBar';
import HubOnboardingBanner from '@/components/hubs/HubOnboardingBanner';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import HubErrorState from '@/components/hubs/HubErrorState';
import HubJobBreadcrumb from '@/components/hubs/HubJobBreadcrumb';

/**
 * HubShell — the one layout every hub renders through (Phase 0 design system).
 *
 *   ┌ optional BackButton (only when the hub is NOT inside AppLayout)
 *   ├ HubHeader   — breadcrumbs · icon · title · subtitle · actions · Help · StatPills
 *   ├ HubOnboardingBanner (first-run, dismissable, per hubKey)
 *   ├ HubQuickLinks — related-hub chips (auto by route, or `hubKey`/`quickLinks`)
 *   ├ kpiStrip    — legacy slot for a hub-specific KPI component
 *   ├ HubTabBar   — sticky on phone/tablet, static on desktop
 *   └ body        — children, or HubLoadingState / HubErrorState when flagged
 *
 * Props
 *   icon, title, subtitle, actions, eyebrow
 *   hubKey        — stable key ('fleet', 'assets'…) for help/onboarding/quick-links
 *   breadcrumbs   — [{ label, to }] rendered inside the header
 *   stats         — [{ icon, label, value, sublabel, color, onClick }] → StatPills
 *   help          — { title, topics: [{ title, summary, body }] } → Help button
 *   onboarding    — { title, description, steps, cta } → first-run banner
 *   kpiStrip, tabs, activeTab, onTabChange, children
 *   loading, error, onRetry — body-level states
 *   showBack (default false — AppLayout already provides Back), backTo
 */
export default function HubShell({
  icon, title, subtitle, actions, eyebrow,
  hubKey, breadcrumbs, stats, help, onboarding, quickLinks,
  kpiStrip, tabs, activeTab, onTabChange,
  loading = false, error = null, onRetry,
  children, backTo, showBack = false,
}) {
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {showBack && <BackButton fallback={backTo || '/admin'} />}

      <HubHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={actions}
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        stats={stats}
        help={help ? { hubKey, ...help } : undefined}
      />

      {onboarding && <HubOnboardingBanner hubKey={hubKey} {...onboarding} />}

      <HubQuickLinks hubKey={hubKey} links={quickLinks} />

      <HubJobBreadcrumb />

      {kpiStrip ? <div className="animate-slide-up">{kpiStrip}</div> : null}

      <HubTabBar tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

      <div className="space-y-3 sm:space-y-4">
        {error ? (
          <HubErrorState error={error} onRetry={onRetry} />
        ) : loading ? (
          <HubLoadingState />
        ) : (
          children
        )}
      </div>
    </div>
  );
}