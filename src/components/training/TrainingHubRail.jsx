import React from 'react';
import { Users, Calendar, BookOpen, Building2 } from 'lucide-react';

const TABS = [
  { key: 'cards', label: 'Staff Cards', icon: Users },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'providers', label: 'Providers', icon: Building2 },
];

/**
 * TrainingHubRail — left vertical dark-green icon rail for the four training
 * hub tabs. Replaces the old top tab bar. On mobile it collapses to a
 * horizontal pill bar; on desktop it's a full-height vertical rail with
 * icon + label buttons and a soft green glow on the active tab.
 */
export default function TrainingHubRail({ view, setView }) {
  return (
    <nav className="flex md:flex-col gap-1.5 p-2 rounded-2xl bg-[#2E5A1A] shadow-lg md:w-44 flex-shrink-0 overflow-x-auto no-scrollbar">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const active = view === tab.key;
        return (
          <button key={tab.key} onClick={() => setView(tab.key)} type="button"
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition whitespace-nowrap flex-shrink-0 md:w-full
              ${active
                ? 'bg-white text-[#2E5A1A] shadow-[0_0_18px_-4px_rgba(141,198,63,0.7)] font-bold'
                : 'text-white/70 hover:text-white hover:bg-white/10 font-medium'}`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * ViewHeader — shared top bar for each training hub view. Shows the view
 * title with a dark-green icon medallion on the left and action buttons
 * on the right. Keeps every view's header visually consistent.
 */
export function ViewHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center flex-shrink-0 shadow-sm">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

/**
 * Smart-link helper — filters training providers to only those whose
 * training_services include the given category (qualification_type).
 * When no category is selected, all training providers are returned.
 */
export function filterProvidersByCategory(providers, category) {
  if (!category) return providers;
  return providers.filter(p => p.training_services?.includes(category));
}

/** Shared button class for secondary header actions (Categories, Bulk Import). */
export const SECONDARY_BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm';

/** Shared button class for primary header actions (Assign Training, New Course). */
export const PRIMARY_BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm';