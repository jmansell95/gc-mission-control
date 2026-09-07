import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  PoundSterling, ShieldCheck, Truck, Boxes, Users, FileBarChart, ClipboardList, ArrowRight,
} from 'lucide-react';

/**
 * HubQuickLinks — shows a row of related-hub quick-link chips on every hub.
 * Reads the current route and surfaces the hubs most relevant to the current
 * context, so managers can jump between related hubs without going back to
 * the admin dashboard.
 *
 * Render inside HubShell (or any hub page) — it auto-detects the current hub
 * and hides itself (returns null) when not on a hub route.
 */

const HUB_RELATIONSHIPS = {
  '/admin': [
    { to: '/billing', label: 'Billing', icon: PoundSterling },
    { to: '/staff', label: 'Staff', icon: Users },
    { to: '/fleet', label: 'Fleet', icon: Truck },
    { to: '/assets', label: 'Assets', icon: Boxes },
    { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
    { to: '/reports', label: 'Reports', icon: FileBarChart },
  ],
  '/billing': [
    { to: '/reports', label: 'Reports', icon: FileBarChart },
    { to: '/staff', label: 'Staff Costs', icon: Users },
    { to: '/admin/logistics', label: 'Logistics', icon: Truck },
  ],
  '/compliance': [
    { to: '/staff', label: 'Training', icon: Users },
    { to: '/assets', label: 'Asset Certs', icon: Boxes },
    { to: '/fleet', label: 'Vehicle Checks', icon: Truck },
  ],
  '/fleet': [
    { to: '/assets', label: 'Rigs & Gear', icon: Boxes },
    { to: '/staff', label: 'Drivers', icon: Users },
    { to: '/admin/logistics', label: 'Deliveries', icon: Truck },
  ],
  '/assets': [
    { to: '/fleet', label: 'Vehicles', icon: Truck },
    { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
    { to: '/admin/logistics', label: 'Deployments', icon: Truck },
  ],
  '/staff': [
    { to: '/compliance', label: 'Training & Certs', icon: ShieldCheck },
    { to: '/billing', label: 'Cost Analytics', icon: PoundSterling },
    { to: '/fleet', label: 'Driver Tracking', icon: Truck },
  ],
  '/reports': [
    { to: '/billing', label: 'Billing', icon: PoundSterling },
    { to: '/staff', label: 'Staff', icon: Users },
    { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  ],
  '/admin/logistics': [
    { to: '/fleet', label: 'Vehicles', icon: Truck },
    { to: '/assets', label: 'Gear', icon: Boxes },
    { to: '/staff', label: 'Drivers', icon: Users },
  ],
};

export default function HubQuickLinks({ hubKey, links }) {
  const location = useLocation();
  // Match exact path first, then the longest prefix (e.g. /assets/:id → /assets)
  // hubKey may be a route ('/fleet'), a bare key ('fleet'), or a nested key ('logistics' → '/admin/logistics')
  const keyFromHub = hubKey
    ? Object.keys(HUB_RELATIONSHIPS).find(k => k === hubKey || k === `/${hubKey}` || k.endsWith(`/${hubKey}`))
    : undefined;
  const matchedKey = keyFromHub
    || (HUB_RELATIONSHIPS[location.pathname] ? location.pathname
      : Object.keys(HUB_RELATIONSHIPS).filter(k => k !== '/admin' && location.pathname.startsWith(k + '/')).sort((a, b) => b.length - a.length)[0]);
  const related = links || HUB_RELATIONSHIPS[matchedKey];

  if (!related || related.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar -mx-1 px-1 sm:flex-wrap sm:overflow-visible animate-slide-up">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
        <ArrowRight className="w-3 h-3" /> Related
      </span>
      {related.map(hub => {
        const Icon = hub.icon;
        return (
          <Link
            key={hub.to}
            to={hub.to}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0 bg-white/80 backdrop-blur border border-slate-200 hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/5 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#2E5A1A] transition-all duration-200 shadow-sm active:scale-[0.97]"
          >
            <Icon className="w-3.5 h-3.5" />
            {hub.label}
          </Link>
        );
      })}
    </div>
  );
}