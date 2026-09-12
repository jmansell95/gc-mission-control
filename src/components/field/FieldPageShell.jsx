import React from 'react';
import { Search } from 'lucide-react';
import FieldGreetingHeader from '@/components/field/FieldGreetingHeader';

/**
 * FieldPageShell — unified layout for all field-facing pages.
 *
 * Renders the shared FieldGreetingHeader (avatar + greeting + name + date +
 * optional stat tiles + actions) followed by the page content.
 *
 * No back button — navigation is via the bottom nav bar or swipe gesture.
 * No title/subtitle in the header — the greeting header is identical on
 * every page so the crew feels one connected product.
 */
export default function FieldPageShell({
  staff,
  stats,
  actions,
  accentColor,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  children,
  contentClassName = '',
  transparent = false,
}) {
  const headerChildren = (
    <>
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            value={search || ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/20 border border-white/20 text-hub-body text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
      )}
      {filters && filters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map(f => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-hub-body font-semibold transition active:scale-95 ${
                  active ? 'bg-white text-primary shadow-sm' : 'bg-white/10 text-white/80 border border-white/20'
                }`}
              >
                {f.label}
                {f.count != null && (
                  <span className={`ml-1.5 text-xs ${active ? 'opacity-80' : 'text-white/50'}`}>{f.count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className={transparent ? "min-h-0" : "min-h-screen page-bg-vibrant"}>
      <FieldGreetingHeader staff={staff} stats={stats} actions={actions} accentColor={accentColor}>
        {headerChildren}
      </FieldGreetingHeader>
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  );
}