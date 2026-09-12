import React from 'react';
import { Users, Calendar, BookOpen, Building2 } from 'lucide-react';
import TabBar from '@/components/TabBar';

const TABS = [
  { id: 'cards', label: 'Staff Cards', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'providers', label: 'Providers', icon: Building2 },
];

/**
 * TrainingHubRail — top tab bar for the four training hub tabs. Now uses the
 * shared TabBar so it matches every other tab nav across the app.
 */
export default function TrainingHubRail({ view, setView }) {
  return <TabBar tabs={TABS} activeTab={view} onChange={setView} />;
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
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
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
export const PRIMARY_BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-sm';