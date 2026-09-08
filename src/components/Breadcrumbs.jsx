import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

// Route-level labels for known paths. The last entry is always the current
// page (non-link). Paths not listed here fall back to auto-generation from
// the URL segments (capitalised, hyphens → spaces).
const ROUTE_MAP = {
  '/': [{ label: 'Dashboard' }],
  '/admin': [{ label: 'Admin Dashboard' }],
  '/admin/logistics': [{ label: 'Admin', to: '/admin' }, { label: 'Deliveries Hub' }],
  '/staff-schedule': [{ label: 'My Schedule' }],
  '/staff-profile': [{ label: 'My Schedule', to: '/staff-schedule' }, { label: 'My Profile' }],
  '/subcontractor': [{ label: 'Subcontractor' }],
  '/deliveries': [{ label: 'Deliveries' }],
  '/help': [{ label: 'Help Guides' }],
  '/presentation-pack': [{ label: 'Presentation Pack' }],
  '/assets': [{ label: 'Admin', to: '/admin' }, { label: 'Assets Hub' }],
  '/fleet': [{ label: 'Admin', to: '/admin' }, { label: 'Tracking Hub' }],
  '/vehicles': [{ label: 'Admin', to: '/admin' }, { label: 'Tracking Hub', to: '/fleet' }],
  '/pat-testing': [{ label: 'Admin', to: '/admin' }, { label: 'Assets Hub', to: '/assets' }, { label: 'PAT Testing' }],
  '/timesheets': [{ label: 'Admin', to: '/admin' }, { label: 'Staff Hub', to: '/staff' }],
  '/compliance': [{ label: 'Admin', to: '/admin' }, { label: 'Compliance Hub' }],
  '/billing': [{ label: 'Admin', to: '/admin' }, { label: 'Financial Hub' }],
  '/safety': [{ label: 'Admin', to: '/admin' }, { label: 'Compliance Hub', to: '/compliance' }, { label: 'Safety' }],
  '/staff': [{ label: 'Admin', to: '/admin' }, { label: 'Staff Hub' }],
  '/contacts': [{ label: 'Admin', to: '/admin' }, { label: 'Staff Hub', to: '/staff' }],
  '/automations': [{ label: 'Admin', to: '/admin' }, { label: 'Settings', to: '/admin' }],
  '/price-list': [{ label: 'Admin', to: '/admin' }, { label: 'Financial Hub', to: '/billing' }],
  '/reports': [{ label: 'Admin', to: '/admin' }, { label: 'Financial Hub', to: '/billing' }],
  '/import': [{ label: 'Admin', to: '/admin' }, { label: 'Settings', to: '/admin' }],
  '/audit': [{ label: 'Admin', to: '/admin' }, { label: 'Compliance Hub', to: '/compliance' }],
  '/keylogbook-docs': [{ label: 'Admin', to: '/admin' }, { label: 'KeyLogBook Docs' }],
  '/roadmap': [{ label: 'Admin', to: '/admin' }, { label: 'Roadmap' }],
};

// Convert a raw path segment into a human-readable label.
function segmentToLabel(seg) {
  return seg
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Auto-generate a breadcrumb trail from the pathname when no explicit map
// entry exists. Each intermediate segment links to its accumulated path.
function autoGenerateTrail(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];
  return segments.map((seg, i, arr) => {
    const to = '/' + arr.slice(0, i + 1).join('/');
    return { label: segmentToLabel(seg), to: i < arr.length - 1 ? to : undefined };
  });
}

export default function Breadcrumbs({ sectionLabel }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  let trail = ROUTE_MAP[pathname] || autoGenerateTrail(pathname);

  // Allow pages with internal section navigation (e.g. AdminDashboard) to
  // append the current sub-section to the trail so users always see where
  // they are, even when the URL doesn't change.
  if (sectionLabel) {
    const last = trail[trail.length - 1];
    if (last) {
      // If the last item already matches the section label, don't duplicate.
      if (last.label !== sectionLabel) {
        // Make the previous last item clickable if it isn't already.
        if (!last.to) last.to = pathname;
        trail = [...trail, { label: sectionLabel }];
      }
    } else {
      trail = [{ label: sectionLabel }];
    }
  }

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const showBack = pathname !== '/admin';

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {showBack && (
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition text-sm font-semibold shadow-sm flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        )}
        <div className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/70 shadow-sm text-sm overflow-hidden">
          <Link to="/" className="flex items-center gap-1 text-slate-400 hover:text-[#2E5A1A] transition font-medium flex-shrink-0">
            <Home className="w-3.5 h-3.5" /><span className="hidden sm:inline">Home</span>
          </Link>
          {trail.map((item, i) => {
            const isLast = i === trail.length - 1;
            return (
              <React.Fragment key={i}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                {item.to && !isLast ? (
                  <Link to={item.to} className="text-slate-400 hover:text-[#2E5A1A] transition font-medium truncate">{item.label}</Link>
                ) : (
                  <span className={`truncate ${isLast ? 'text-[#2E5A1A] font-semibold' : 'text-slate-500 font-medium'}`}>{item.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}