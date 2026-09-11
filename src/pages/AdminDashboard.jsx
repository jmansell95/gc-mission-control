import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { canAccessSection } from '@/utils/access';
import { STANDALONE_ROUTES } from '@/utils/standaloneRoutes';
import AdminNav from '@/components/AdminNav';
import DashboardOverview from '@/components/DashboardOverview';
import JobManager from '@/components/JobManager';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import SchedulingHub from '@/components/SchedulingHub';
import InvestigationHub from '@/components/investigation/InvestigationHub';
import AdminDeliveryHub from '@/pages/AdminDeliveryHub';
import ErrorBoundary from '@/components/ErrorBoundary';
import Breadcrumbs from '@/components/Breadcrumbs';
import DashboardUserMenu from '@/components/DashboardUserMenu';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import { JobFilterProvider } from '@/components/dashboard/JobFilterContext';
import PageLoadingOverlay from '@/components/PageLoadingOverlay';
import ReadinessGate from '@/components/ReadinessGate';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import CrewCommsManager from '@/components/admin/CrewCommsManager';
import { useReadiness } from '@/hooks/useReadiness';

const SECTION_LABELS = {
  overview: 'Dashboard',
  'crew-comms': 'Crew Comms',
  'job-detail': 'Project Detail',
  jobs: 'Projects Hub',
  scheduling: 'Scheduling Hub',
  rota: 'Scheduling Hub',
  calendar: 'Calendar',
  logistics: 'Logistics Hub',
  timesheets: 'Timesheets',
  teams: 'People Hub',
  compliance: 'Compliance Hub',
  safety: 'Safety',
  'safety-hub': 'Safety Hub',
  'log-qc': 'Audit',
  investigation: 'Investigation Hub',
  billing: 'Financial Hub',
  performance: 'Performance Hub',
  settings: 'Settings',
  assets: 'Assets Hub',
  fleet: 'Fleet Hub',
  vehicles: 'Fleet Hub',
  staff: 'People Hub',
  contacts: 'Contacts',
  automations: 'Automations',
  'price-list': 'Price List',
  reports: 'Reports',
  import: 'Import',
  audit: 'Audit',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobInitialTab, setJobInitialTab] = useState(null);
  const [settingsTab, setSettingsTab] = useState('hub');
  const [schedulingTab, setSchedulingTab] = useState('rota');
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const prevSection = useRef(activeSection);
  const { isComingSoon, isLocked } = useReadiness();
  const goToSettings = () => { setSettingsTab('hub'); setActiveSection('settings'); };

  // Read navigation state passed from other pages (e.g. More sheet → Scheduling Hub).
  // Standalone sections are redirected immediately so the dashboard never
  // tries to render a panel it doesn't have (which caused blank screens).
  // Depends on location.state so re-navigating to /admin with new state
  // (e.g. from the mobile More sheet while already on /admin) is picked up.
  useEffect(() => {
    const navState = location.state;
    if (!navState || Object.keys(navState).length === 0) return;
    if (navState.section && STANDALONE_ROUTES[navState.section]) {
      navigate(STANDALONE_ROUTES[navState.section], { replace: true });
      return;
    }
    if (navState.section) {
      setActiveSection(navState.section);
      if (navState.section === 'scheduling' || navState.section === 'rota') {
        setSchedulingTab('rota');
      } else if (navState.section === 'calendar') {
        setSchedulingTab('calendar');
      }
    }
    if (navState.settingsTab) setSettingsTab(navState.settingsTab);
    if (navState.job) { setSelectedJob(navState.job); if (navState.jobTab) setJobInitialTab(navState.jobTab); }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper that sends standalone sections (Staff, Contacts, Price List, etc.)
  // straight to their own routes — avoids the blank-flash round-trip through
  // the internal section state.
  const handleSetActiveSection = (sectionOrObj) => {
    const isObj = typeof sectionOrObj === 'object' && sectionOrObj;
    const section = isObj ? sectionOrObj.section : sectionOrObj;
    if (!section) return;
    if (isObj && sectionOrObj.schedulingTab) {
      setSchedulingTab(sectionOrObj.schedulingTab);
    } else if (section === 'calendar') {
      setSchedulingTab('calendar');
    } else if (section === 'scheduling' || section === 'rota') {
      setSchedulingTab('rota');
    }
    if (STANDALONE_ROUTES[section]) {
      const navState = isObj && sectionOrObj.staffTab ? { state: { initialTab: sectionOrObj.staffTab } } : undefined;
      navigate(STANDALONE_ROUTES[section], navState);
    } else {
      setActiveSection(section);
    }
  };

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  // Show loading overlay on section transitions
  useEffect(() => {
    if (prevSection.current !== activeSection) {
      prevSection.current = activeSection;
      setPageLoading(true);
      const timer = setTimeout(() => setPageLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [activeSection]);

  // Guard: reset to overview if the active section isn't accessible to this user's role.
  // 'job-detail' is a sub-view reached from the dashboard, not a nav section — skip the guard for it.
  useEffect(() => {
    if (profile && activeSection !== 'job-detail' && !canAccessSection(profile, activeSection)) {
      setActiveSection('overview');
    }
  }, [profile, activeSection]);

  useEffect(() => {
    const handler = (e) => {
      const { section, job, settingsTab: tab, jobTab } = e.detail || {};
      if (job) setSelectedJob(job);
      if (job) setJobInitialTab(jobTab || null);
      if (tab) setSettingsTab(tab);
      if (section) {
        if (profile && !canAccessSection(profile, section)) return;
        handleSetActiveSection(section);
      }
    };
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-bg-vibrant">
      <PageLoadingOverlay isLoading={pageLoading} pageName={SECTION_LABELS[activeSection]} />
      <AdminNav activeSection={activeSection} setActiveSection={handleSetActiveSection} onSettingsTabClick={(tab) => { setSettingsTab(tab); setActiveSection('settings'); }} />
      <div className="flex-1 flex flex-col min-h-0">
      <main className="flex-1 overflow-auto safe-area-top lg:pt-4">
        <RedAlertBanner />
        <DivisionIdentityBar />
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 pt-3 lg:pt-6 pb-10 lg:pb-8 w-full max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between gap-3">
            <Breadcrumbs sectionLabel={SECTION_LABELS[activeSection]} />
            <div className="hidden lg:block">
              <DashboardUserMenu />
            </div>
          </div>
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ErrorBoundary key={activeSection}>
            {activeSection === 'overview' && (
              <ReadinessGate featureId="dashboard" onConfigure={goToSettings}>
                <JobFilterProvider>
                  <DashboardOverview
                    onNavigate={handleSetActiveSection}
                    onSelectJob={(job, tab) => { setSelectedJob(job); setJobInitialTab(tab || null); setActiveSection('job-detail'); }}
                  />
                </JobFilterProvider>
              </ReadinessGate>
            )}
            {activeSection === 'crew-comms' && (
              <CrewCommsManager />
            )}
            {activeSection === 'job-detail' && selectedJob && (
              <JobDetail job={selectedJob} initialTab={jobInitialTab} onBack={() => setActiveSection('overview')} />
            )}
            {activeSection === 'jobs' && (
              <ReadinessGate featureId="jobs" onConfigure={goToSettings}>
                <JobManager onNavigateRota={() => setActiveSection('scheduling')} />
              </ReadinessGate>
            )}
            {(activeSection === 'scheduling' || activeSection === 'rota' || activeSection === 'calendar') && (
              <ReadinessGate featureId="scheduling" onConfigure={goToSettings}>
                <SchedulingHub initialTab={activeSection === 'calendar' ? 'calendar' : schedulingTab} />
              </ReadinessGate>
            )}
            {activeSection === 'logistics' && (
              <ReadinessGate featureId="logistics" onConfigure={goToSettings}>
                <AdminDeliveryHub />
              </ReadinessGate>
            )}
            {activeSection === 'investigation' && (
              <ReadinessGate featureId="investigation" onConfigure={goToSettings}>
                <InvestigationHub onNavigate={handleSetActiveSection} />
              </ReadinessGate>
            )}
            {activeSection === 'settings' && <SettingsPage initialTab={settingsTab} onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }} />}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>
      </div>
    </div>
  );
}