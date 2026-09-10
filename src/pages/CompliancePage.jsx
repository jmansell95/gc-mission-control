import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat,
  CalendarDays, ExternalLink, Lock, Siren, Leaf, Users,
  FileX, FileText, Clock, TrendingUp, XCircle,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import { COMPLIANCE_HELP_TOPICS, COMPLIANCE_ONBOARDING, COMPLIANCE_QUICK_LINKS } from '@/components/compliance/complianceHubContent';
import AuditDashboardTab from '@/components/compliance/AuditDashboardTab';
import StaffComplianceDirectory from '@/components/compliance/StaffComplianceDirectory';
import JobPacksTab from '@/components/compliance/JobPacksTab';
import IncidentTimelineTab from '@/components/compliance/IncidentTimelineTab';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';
import ComplianceCalendar from '@/components/compliance/ComplianceCalendar';
import SiteReadinessGateWidget from '@/components/dashboard/SiteReadinessGateWidget';
import CrewCertificationPulseWidget from '@/components/dashboard/CrewCertificationPulseWidget';
import CarbonFootprintWidget from '@/components/dashboard/CarbonFootprintWidget';
import CarbonFootprintByProject from '@/components/dashboard/CarbonFootprintByProject';
import CrewShiftStatusWidget from '@/components/compliance/CrewShiftStatusWidget';
import RunReportButton from '@/components/reports/RunReportButton';
import { resolveRole } from '@/utils/access';
import { useAuth } from '@/lib/AuthContext';

const SC_URL = 'https://app.safetyculture.com';

const TABS = [
  { id: 'mitti', label: 'Mitti Audits', icon: BarChart3, sub: [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
  ]},
  { id: 'compliance-checks', label: 'Compliance Checks', icon: ShieldCheck, sub: [
    { id: 'staff-compliance', label: 'Staff Compliance', icon: Users },
    { id: 'crew-checks', label: 'Crew Checks', icon: Users },
    { id: 'job-packs', label: 'Job Packs', icon: FileText },
    { id: 'readiness', label: 'Readiness Gate', icon: ShieldCheck },
  ]},
  { id: 'incidents', label: 'Incidents', icon: Siren, sub: [
    { id: 'timeline', label: 'Timeline', icon: Siren },
    { id: 'report', label: 'Report Incident', icon: AlertTriangle },
    { id: 'riddor', label: 'H&S Stats', icon: BarChart3 },
  ]},
  { id: 'training', label: 'Training', icon: HardHat, sub: [
    { id: 'toolbox', label: 'Toolbox Talks', icon: HardHat },
    { id: 'calendar', label: 'Compliance Calendar', icon: CalendarDays },
    { id: 'certs', label: 'Cert Pulse', icon: Users },
  ]},
  { id: 'environmental', label: 'Environmental', icon: Leaf, sub: [
    { id: 'carbon', label: 'Carbon Footprint', icon: Leaf },
    { id: 'by-project', label: 'By Project', icon: BarChart3 },
  ]},
];

export default function CompliancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('audit-dashboard');
  const [subTab, setSubTab] = useState('overview');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const role = resolveRole(profile, isPlatformAdmin);
  const canAccess = isPlatformAdmin || role === 'admin' || role === 'super_admin' || role === 'management' || role === 'manager';
  const profileLoading = !canAccess && !profile && !isPlatformAdmin;

  const { data: safetyReports = [] } = useQuery({ queryKey: ['safety-reports-open'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-staff'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }, '-created_date', 500) });
  const { data: toolboxTalks = [] } = useQuery({ queryKey: ['toolbox-talks'], queryFn: () => base44.entities.ToolboxTalk.list('-created_date', 100) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-active'], queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500) });
  const { data: allReports = [] } = useQuery({ queryKey: ['safety-reports-all-compliance'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 200) });

  const complianceKpis = (() => {
    const now = new Date();
    let expiringSoon = 0, expired = 0;
    complianceItems.forEach(ci => {
      if (!ci.expiry_date || ci.status_override === 'not_required') return;
      try {
        const d = new Date(ci.expiry_date + '-01');
        if (isNaN(d.getTime())) return;
        const days = Math.ceil((d - now) / 86400000);
        if (days < 0) expired++;
        else if (days <= 30) expiringSoon++;
      } catch {}
    });
    const recentTalks = toolboxTalks.filter(t => {
      try { return new Date(t.date) >= new Date(Date.now() - 30 * 86400000); } catch { return false; }
    }).length;
    const failedAudits = allReports.filter(r => r.pass_fail === 'fail').length;
    const avgScore = allReports.filter(r => r.score_percentage != null).length > 0
      ? Math.round(allReports.filter(r => r.score_percentage != null).reduce((s, r) => s + r.score_percentage, 0) / allReports.filter(r => r.score_percentage != null).length)
      : 0;
    return { openIncidents: safetyReports.length, expiringSoon, expired, recentTalks, totalStaff: staff.length, failedAudits, avgScore };
  })();

  const navToAdmin = (section) => navigate('/admin', { state: { section } });

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        {profileLoading ? (
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin"></div>
        ) : (
          <div className="insight-card rounded-3xl p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Management Access Only</h2>
            <p className="text-sm text-slate-500">The Safety & Compliance Hub is restricted to management and admin roles. Contact your supervisor if you need access.</p>
          </div>
        )}
      </div>
    );
  }

  const activeTab = TABS.find(t => t.id === tab);
  const handleTabChange = (t) => {
    setTab(t);
    const at = TABS.find(x => x.id === t);
    setSubTab(at?.sub?.[0]?.id || t);
  };

  return (
    <HubShell
      hubKey="compliance"
      icon={ShieldAlert}
      eyebrow="Compliance Hub"
      title="Safety & Compliance"
      subtitle="Full Mitti audit intelligence — scores, trends, action items, incidents & readiness"
      breadcrumbs={[{ label: 'Compliance Hub' }]}
      actions={
        <div className="flex items-center gap-2">
          <RunReportButton hub="compliance" />
          <a href={SC_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95">
            <ExternalLink className="w-3.5 h-3.5" /> Mitti
          </a>
        </div>
      }
      stats={[
        { icon: AlertTriangle, label: 'Open Incidents', value: complianceKpis.openIncidents, sublabel: 'Needs attention', color: complianceKpis.openIncidents > 0 ? 'rose' : 'emerald' },
        { icon: XCircle, label: 'Failed Audits', value: complianceKpis.failedAudits, sublabel: 'From Mitti', color: complianceKpis.failedAudits > 0 ? 'rose' : 'emerald' },
        { icon: TrendingUp, label: 'Avg Score', value: `${complianceKpis.avgScore}%`, sublabel: 'All audits', color: 'blue' },
        { icon: FileX, label: 'Expired Certs', value: complianceKpis.expired, sublabel: 'Overdue', color: complianceKpis.expired > 0 ? 'rose' : 'emerald' },
        { icon: Clock, label: 'Expiring Soon', value: complianceKpis.expiringSoon, sublabel: 'Within 30 days', color: complianceKpis.expiringSoon > 0 ? 'amber' : 'slate' },
        { icon: HardHat, label: 'Toolbox Talks', value: complianceKpis.recentTalks, sublabel: 'Last 30 days', color: 'brand' },
      ]}
      help={{ title: 'Compliance Hub — how it works', topics: COMPLIANCE_HELP_TOPICS }}
      onboarding={COMPLIANCE_ONBOARDING}
      quickLinks={COMPLIANCE_QUICK_LINKS}
      tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
      activeTab={tab}
      onTabChange={handleTabChange}
    >
      <SubPills active={subTab} onChange={setSubTab} pills={activeTab?.sub || []} />

      {tab === 'mitti' && (
        <AuditDashboardTab />
      )}

      {tab === 'compliance-checks' && (
        <>
          {subTab === 'staff-compliance' && <StaffComplianceDirectory />}
          {subTab === 'crew-checks' && <CrewShiftStatusWidget />}
          {subTab === 'job-packs' && <JobPacksTab />}
          {subTab === 'readiness' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SiteReadinessGateWidget onNavigate={navToAdmin} />
              <CrewCertificationPulseWidget onNavigate={navToAdmin} />
            </div>
          )}
        </>
      )}

      {tab === 'incidents' && (
        <>
          {subTab === 'timeline' && <IncidentTimelineTab onReportIncident={() => setSubTab('report')} />}
          {subTab === 'report' && <IncidentReporter />}
          {subTab === 'riddor' && <RIDDORStatsPanel />}
        </>
      )}

      {tab === 'training' && (
        <>
          {subTab === 'toolbox' && <ToolboxTalkManager />}
          {subTab === 'calendar' && <ComplianceCalendar />}
          {subTab === 'certs' && <CrewCertificationPulseWidget onNavigate={navToAdmin} />}
        </>
      )}

      {tab === 'environmental' && (
        <>
          {subTab === 'carbon' && <CarbonFootprintWidget onNavigate={navToAdmin} />}
          {subTab === 'by-project' && <CarbonFootprintByProject />}
        </>
      )}
    </HubShell>
  );
}