import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat,
  CalendarDays, ExternalLink, Lock,
  TrendingUp, FileX, Clock, Users, Siren, Leaf,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import { COMPLIANCE_HELP_TOPICS, COMPLIANCE_ONBOARDING, COMPLIANCE_QUICK_LINKS } from '@/components/compliance/complianceHubContent';
import SafetyCultureGate from '@/components/safety/SafetyCultureGate';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';
import ComplianceCalendar from '@/components/compliance/ComplianceCalendar';
import SiteReadinessGateWidget from '@/components/dashboard/SiteReadinessGateWidget';
import CrewCertificationPulseWidget from '@/components/dashboard/CrewCertificationPulseWidget';
import CarbonFootprintWidget from '@/components/dashboard/CarbonFootprintWidget';
import CrewShiftStatusWidget from '@/components/compliance/CrewShiftStatusWidget';
import RunReportButton from '@/components/reports/RunReportButton';
import { resolveRole } from '@/utils/access';

const SC_URL = 'https://app.safetyculture.com';

// 3 consolidated tabs (down from 7)
const TABS = [
  {
    id: 'safety', label: 'Safety', icon: ShieldAlert, sub: [
      { id: 'crew-shift', label: 'Crew Shift Status', icon: Users },
      { id: 'safety-hub', label: 'Safety Hub', icon: ShieldAlert },
      { id: 'incidents', label: 'Incidents', icon: Siren },
      { id: 'stats', label: 'H&S Stats', icon: BarChart3 },
    ],
  },
  {
    id: 'readiness', label: 'Readiness', icon: ShieldCheck, sub: [
      { id: 'readiness', label: 'Readiness Gate', icon: ShieldCheck },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    id: 'training-env', label: 'Training & Env', icon: HardHat, sub: [
      { id: 'toolbox', label: 'Toolbox Talks', icon: HardHat },
      { id: 'environmental', label: 'Environmental', icon: Leaf },
    ],
  },
];

export default function CompliancePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('safety');
  const [subTab, setSubTab] = useState('crew-shift');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const role = resolveRole(profile) || 'field';
  const canAccess = role === 'admin' || role === 'super_admin' || role === 'management' || role === 'manager';

  // Compliance KPI data
  const { data: safetyReports = [] } = useQuery({ queryKey: ['safety-reports-open'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-staff'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }, '-created_date', 500) });
  const { data: toolboxTalks = [] } = useQuery({ queryKey: ['toolbox-talks'], queryFn: () => base44.entities.ToolboxTalk.list('-created_date', 100) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-active'], queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500) });

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
    return { openIncidents: safetyReports.length, expiringSoon, expired, recentTalks, totalStaff: staff.length };
  })();

  const navToAdmin = (section) => navigate('/admin', { state: { section } });

  // Access guard — management & admin only
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="insight-card rounded-3xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Management Access Only</h2>
          <p className="text-sm text-slate-500">
            The Safety & Compliance Hub is restricted to management and admin roles.
            Contact your supervisor if you need access.
          </p>
        </div>
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
      subtitle="Mitti integration pending — configure in Settings to sync audits & incidents"
      breadcrumbs={[{ label: 'Compliance Hub' }]}
      actions={
        <div className="flex items-center gap-2">
          <RunReportButton hub="compliance" />
          <a
            href={SC_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Mitti
          </a>
        </div>
      }
      stats={[
        { icon: AlertTriangle, label: 'Open Incidents', value: complianceKpis.openIncidents, sublabel: 'Needs attention', color: complianceKpis.openIncidents > 0 ? 'rose' : 'emerald' },
        { icon: FileX, label: 'Expired Certs', value: complianceKpis.expired, sublabel: 'Overdue', color: complianceKpis.expired > 0 ? 'rose' : 'emerald' },
        { icon: Clock, label: 'Expiring Soon', value: complianceKpis.expiringSoon, sublabel: 'Within 30 days', color: complianceKpis.expiringSoon > 0 ? 'amber' : 'slate' },
        { icon: Users, label: 'Active Staff', value: complianceKpis.totalStaff, sublabel: 'In scope', color: 'blue' },
        { icon: HardHat, label: 'Toolbox Talks', value: complianceKpis.recentTalks, sublabel: 'Last 30 days', color: 'brand' },
      ]}
      help={{ title: 'Compliance Hub — how it works', topics: COMPLIANCE_HELP_TOPICS }}
      onboarding={COMPLIANCE_ONBOARDING}
      quickLinks={COMPLIANCE_QUICK_LINKS}
      tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
      activeTab={tab}
      onTabChange={handleTabChange}
    >

      {/* ── Sub-pills for the active tab ── */}
      <SubPills active={subTab} onChange={setSubTab} pills={activeTab?.sub || []} />

      {/* ── Tab Content — all gated by SafetyCulture connection status ── */}
      {tab === 'safety' && (
        <>
          {subTab === 'crew-shift' && (
            <CrewShiftStatusWidget />
          )}
          {subTab === 'safety-hub' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <SafetyCultureCheckHub onNavigate={navToAdmin} />
            </SafetyCultureGate>
          )}
          {subTab === 'incidents' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <IncidentReporter />
            </SafetyCultureGate>
          )}
          {subTab === 'stats' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <RIDDORStatsPanel />
            </SafetyCultureGate>
          )}
        </>
      )}

      {tab === 'readiness' && (
        <>
          {subTab === 'readiness' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SiteReadinessGateWidget onNavigate={navToAdmin} />
                <CrewCertificationPulseWidget onNavigate={navToAdmin} />
              </div>
            </SafetyCultureGate>
          )}
          {subTab === 'calendar' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <ComplianceCalendar />
            </SafetyCultureGate>
          )}
        </>
      )}

      {tab === 'training-env' && (
        <>
          {subTab === 'toolbox' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <ToolboxTalkManager />
            </SafetyCultureGate>
          )}
          {subTab === 'environmental' && (
            <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
              <CarbonFootprintWidget onNavigate={navToAdmin} />
            </SafetyCultureGate>
          )}
        </>
      )}
    </HubShell>
  );
}