import React from 'react';
import HubBreadcrumb from '@/components/hubs/HubBreadcrumb';
import HubHelpButton from '@/components/hubs/HubHelpButton';
import StatPill from '@/components/hubs/StatPill';

/**
 * HubHeader — the unified hub masthead.
 *   breadcrumb trail · icon tile · title · subtitle · actions · help button
 *   optional StatPill row underneath
 *
 * Props: icon, title, subtitle, actions, breadcrumbs, help {hubKey,title,topics}, stats []
 */
export default function HubHeader({ icon: Icon, title, subtitle, actions, breadcrumbs, help, stats = [], eyebrow }) {
  return (
    <div className="relative rounded-3xl hub-glass overflow-hidden animate-slide-up">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#2E5A1A] via-[#5A8C1E] to-[#8DC63F]" />
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#8DC63F]/10 blur-2xl pointer-events-none" />
      <div className="relative px-4 sm:px-6 py-4 sm:py-5 pl-5 sm:pl-7 space-y-3">
        {breadcrumbs?.length > 0 && <HubBreadcrumb items={breadcrumbs} />}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {Icon && (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && <div className="text-ui-micro uppercase tracking-[0.18em] text-[#2E5A1A]/70 mb-0.5">{eyebrow}</div>}
              <h1 className="text-ui-heading sm:text-ui-display font-extrabold tracking-tight text-slate-900 leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-ui-caption sm:text-ui-body text-slate-500 mt-0.5 line-clamp-2 md:truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end [&>button]:whitespace-nowrap">
            {actions}
            {help && <HubHelpButton {...help} />}
          </div>
        </div>
        {stats.length > 0 && (
          <div className={`grid gap-2 sm:gap-2.5 pt-1 ${stats.length <= 3 ? 'grid-cols-3' : stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'}`}>
            {stats.map((s, i) => <StatPill key={i} index={i} {...s} />)}
          </div>
        )}
      </div>
    </div>
  );
}