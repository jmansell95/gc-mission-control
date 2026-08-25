import React from 'react';
import {
  LayoutDashboard, BarChart3, PoundSterling, Briefcase, Car, Users,
  ShieldCheck, Boxes, FlaskConical, Truck, Bookmark, Plus,
} from 'lucide-react';

export const REPORT_CATEGORIES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'financial', label: 'Financial', icon: PoundSterling },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'fleet', label: 'Fleet', icon: Car },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'assets', label: 'Assets', icon: Boxes },
  { id: 'geotech', label: 'Geotech', icon: FlaskConical },
  { id: 'logistics', label: 'Logistics', icon: Truck },
  { id: 'powerbi', label: 'Power BI', icon: BarChart3 },
  { id: 'templates', label: 'My Reports', icon: Bookmark },
  { id: 'custom', label: 'Custom Builder', icon: Plus },
];

/**
 * Category navigation — vertical sidebar on desktop, horizontal scroll pills
 * on mobile. Each item shows an icon + label + optional count badge.
 */
export default function ReportSidebar({ category, setCategory, counts = {} }) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="insight-card rounded-2xl p-2 sticky top-4">
          {REPORT_CATEGORIES.map(c => {
            const Icon = c.icon;
            const active = c.id === category;
            const count = counts[c.id];
            return (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition mb-0.5 ${active ? 'command-gradient text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{c.label}</span>
                {count != null && count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile pills */}
      <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {REPORT_CATEGORIES.map(c => {
          const Icon = c.icon;
          const active = c.id === category;
          return (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${active ? 'command-gradient text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600'}`}>
              <Icon className="w-4 h-4" /> {c.label}
            </button>
          );
        })}
      </div>
    </>
  );
}