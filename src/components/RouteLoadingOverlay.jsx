import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import PageLoadingOverlay from '@/components/PageLoadingOverlay';

const ROUTE_NAMES = {
  '/': 'Dashboard',
  '/admin': 'Admin Dashboard',
  '/staff-schedule': 'My Schedule',
  '/staff-profile': 'My Profile',
  '/deliveries': 'Deliveries',
  '/help': 'Help Guides',
  '/assets': 'Assets Hub',
  '/fleet': 'Fleet Hub',
  '/compliance': 'Compliance Hub',
  '/billing': 'Financial Hub',
  '/staff': 'People Hub',
  '/subcontractor': 'Subcontractor Portal',
  '/admin/logistics': 'Deliveries Hub',
  '/scanner': 'Asset Scanner',
  '/pat-testing': 'PAT Testing',
  '/keylogbook-docs': 'KeyLogBook Docs',
  '/roadmap': 'Improvement Roadmap',
  '/m365-setup-guide': 'Microsoft 365 Setup',
  '/presentation-pack': 'Presentation Pack',
};

function deriveName(pathname) {
  if (ROUTE_NAMES[pathname]) return ROUTE_NAMES[pathname];
  const last = pathname.split('/').filter(Boolean).pop();
  if (!last) return 'Dashboard';
  return last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function RouteLoadingOverlay() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  return <PageLoadingOverlay isLoading={isLoading} pageName={deriveName(location.pathname)} />;
}