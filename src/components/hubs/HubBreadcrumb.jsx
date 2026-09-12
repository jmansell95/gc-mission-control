import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

/**
 * HubBreadcrumb — compact in-hub trail. Always starts at the Admin Dashboard
 * and ends on the current (non-link) hub/page.
 * items: [{ label, to? }] — last item is rendered as current.
 */
export default function HubBreadcrumb({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Hub breadcrumb" className="flex items-center gap-1 text-ui-caption font-medium text-slate-400 min-w-0 overflow-hidden">
      <Link to="/admin" className="inline-flex items-center gap-1 hover:text-primary transition flex-shrink-0">
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            {item.to && !last ? (
              <Link to={item.to} className="hover:text-primary transition truncate">{item.label}</Link>
            ) : (
              <span className={`truncate ${last ? 'text-slate-700 font-semibold' : ''}`}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}