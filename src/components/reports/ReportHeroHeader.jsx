import React from 'react';
import { FileBarChart, Sparkles } from 'lucide-react';

/**
 * Hero header for the redesigned Reports Hub — Ground Control brand gradient,
 * title, subtitle, and a quick-action slot for the primary CTA.
 */
export default function ReportHeroHeader({ onBuildCustom }) {
  return (
    <div className="hero-vibrant rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
      <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-[#8DC63F]/10 blur-xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Reporting Hub</h1>
            <p className="text-sm sm:text-base text-white/80 mt-1 max-w-xl">
              Unified analytics across every hub — financials, fleet, staff, compliance, assets and more.
              Drill into any chart to see the live records behind it.
            </p>
          </div>
        </div>
        {onBuildCustom && (
          <button
            onClick={onBuildCustom}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-sm font-bold hover:bg-white/90 transition shadow-lg flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Build Custom Report
          </button>
        )}
      </div>
    </div>
  );
}