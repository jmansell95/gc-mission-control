import React from 'react';
import RigsOnSiteBentoWidget from '@/components/dashboard/RigsOnSiteBentoWidget';
import LiveDrillingRevenueWidget from '@/components/dashboard/LiveDrillingRevenueWidget';
import SafetyMittiStatusWidget from '@/components/dashboard/SafetyMittiStatusWidget';
import BillingPipelineWidget from '@/components/dashboard/BillingPipelineWidget';
import BoreholesInProgressWidget from '@/components/dashboard/BoreholesInProgressWidget';
import ExceptionMonitorWidget from '@/components/dashboard/ExceptionMonitorWidget';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import BentoStatTiles from '@/components/dashboard/BentoStatTiles';

/**
 * BentoDashboard — the fixed modern bento grid for the geotech Admin Dashboard.
 *
 * Layout (no drag-drop, no resize — just a polished fixed arrangement):
 *  1. Hero row: 3 XL tiles (Rigs on Site, Live Drilling Revenue, Safety/Mitti)
 *  2. Middle row: 3 M tiles (Billing Pipeline, Boreholes, Needs Attention)
 *  3. Full-width: Active Sites (SiteSnapshotGrid with maps + crew)
 *  4. Lower section: compact stat tiles (8 clickable KPIs)
 *
 * Every widget deep-links to its target hub on click.
 */
export default function BentoDashboard({ onNavigate, onSelectJob, onOpenJobDrawer, onJobBreakdown }) {
  return (
    <div className="space-y-4 lg:space-y-5">
      {/* ── Key Metrics — at the top for immediate visibility ── */}
      <div>
        <h3 className="text-ui-micro font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1">Key Metrics</h3>
        <BentoStatTiles onNavigate={onNavigate} />
      </div>

      {/* ── Hero row — 3 XL tiles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RigsOnSiteBentoWidget onJobBreakdown={onJobBreakdown} />
        <LiveDrillingRevenueWidget onNavigate={onNavigate} />
        <SafetyMittiStatusWidget onNavigate={onNavigate} />
      </div>

      {/* ── Middle row — 3 M tiles ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BillingPipelineWidget onNavigate={onNavigate} />
        <BoreholesInProgressWidget onNavigate={onNavigate} />
        <ExceptionMonitorWidget onNavigate={onNavigate} />
      </div>

      {/* ── Active Sites — full width with maps + crew ── */}
      <SiteSnapshotGrid onSelectJob={onOpenJobDrawer || onSelectJob} onNavigate={onNavigate} />

    </div>
  );
}