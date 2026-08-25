import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Clock, UsersRound, Building2, GraduationCap, UserCheck, HardHat } from 'lucide-react';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import SettingsPage from '@/components/SettingsPage';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import MissingRatesBanner from '@/components/staff/MissingRatesBanner';
import CrewProfilesTab from '@/components/staff/CrewProfilesTab';
import StaffCostAnalytics from '@/components/staff/StaffCostAnalytics';
import StaffUtilizationWidget from '@/components/dashboard/StaffUtilizationWidget';
import TrainingMatrixHub from '@/components/staff/TrainingMatrixHub';
import RunReportButton from '@/components/reports/RunReportButton';

// Map legacy tab IDs onto the new 4-tab structure so deep links don't break
const TAB_MAP = {
  'staff': { tab: 'people', sub: 'staff' },
  'staff-reviews': { tab: 'people', sub: 'staff-reviews' },
  'teams': { tab: 'people', sub: 'teams' },
  'directory': { tab: 'people', sub: 'staff' },
  'cost-analytics': { tab: 'people', sub: 'insights' },
  'utilization': { tab: 'people', sub: 'insights' },
  'timesheets': { tab: 'time-pay', sub: 'timesheets' },
  'timesheet-delegation': { tab: 'time-pay', sub: 'timesheet-delegation' },
  'holiday-accrual': { tab: 'time-pay', sub: 'holiday-accrual' },
  'absences': { tab: 'time-pay', sub: 'absences' },
  'training': { tab: 'training' },
  'clients': { tab: 'contacts', sub: 'clients' },
  'contractors': { tab: 'contacts', sub: 'contractors' },
  'suppliers': { tab: 'contacts', sub: 'suppliers' },
  'access-levels': { tab: 'people', sub: 'staff' },
};

// 4 consolidated tabs (down from 7 + standalone views)
const TABS = [
  {
    id: 'people', label: 'People', icon: Users, sub: [
      { id: 'crew-profiles', label: 'Crew Profiles' },
      { id: 'staff', label: 'Crew Members' },
      { id: 'teams', label: 'Crew Types' },
      { id: 'staff-reviews', label: 'Reviews' },
      { id: 'insights', label: 'Insights' },
    ],
  },
  {
    id: 'time-pay', label: 'Time & Pay', icon: Clock, sub: [
      { id: 'timesheets', label: 'Timesheets' },
      { id: 'timesheet-delegation', label: 'Delegation' },
      { id: 'holiday-accrual', label: 'Holiday Accrual' },
      { id: 'absences', label: 'Absences' },
    ],
  },
  { id: 'training', label: 'Training', icon: GraduationCap },
  {
    id: 'contacts', label: 'Contacts', icon: Building2, sub: [
      { id: 'clients', label: 'Clients' },
      { id: 'contractors', label: 'Subcontractors' },
      { id: 'suppliers', label: 'Suppliers' },
    ],
  },
];

export default function StaffPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = location.state?.initialTab || 'staff';
  const mapped = TAB_MAP[initial] || { tab: 'people', sub: 'staff' };
  const [tab, setTab] = useState(mapped.tab);
  const [subTab, setSubTab] = useState(mapped.sub || null);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff-page-hub'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const staffStats = useMemo(() => {
    const active = allStaff.filter(s => s.is_active !== false).length;
    const subcontractors = allStaff.filter(s => s.worker_type === 'subcontractor').length;
    const agency = allStaff.filter(s => s.worker_type === 'agency').length;
    return { total: allStaff.length, active, subcontractors, agency };
  }, [allStaff]);

  const activeTab = TABS.find(t => t.id === tab);
  const hasSub = activeTab?.sub?.length > 0;
  const renderTab = hasSub ? (subTab || activeTab.sub[0].id) : tab;

  const handleTabChange = (t) => {
    setTab(t);
    const at = TABS.find(x => x.id === t);
    setSubTab(at?.sub?.[0]?.id || null);
  };

  return (
    <HubShell
      icon={Users}
      title="People & Team Management"
      subtitle="Manage crew members, timesheets, clients, subcontractors and suppliers"
      actions={<RunReportButton hub="staff" />}
      tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
      activeTab={tab}
      onTabChange={handleTabChange}
      kpiStrip={staffStats.total > 0 ? (
        <HubStatsBar tiles={[
          { icon: Users, label: 'Total People', value: staffStats.total, sublabel: 'All records', color: 'brand' },
          { icon: UserCheck, label: 'Active', value: staffStats.active, sublabel: 'Currently employed', color: 'emerald' },
          { icon: HardHat, label: 'Subcontractors', value: staffStats.subcontractors, sublabel: 'External crews', color: 'amber' },
          { icon: UsersRound, label: 'Agency', value: staffStats.agency, sublabel: 'Temp labour', color: 'blue' },
        ]} />
      ) : null}
    >
      <MissingRatesBanner />

      {hasSub && <SubPills active={renderTab} onChange={setSubTab} pills={activeTab.sub} />}

      {tab === 'training' ? (
        <TrainingMatrixHub />
      ) : tab === 'people' && renderTab === 'crew-profiles' ? (
        <CrewProfilesTab />
      ) : tab === 'people' && renderTab === 'insights' ? (
        <div className="space-y-4">
          <StaffCostAnalytics />
          <StaffUtilizationWidget onNavigate={(section) => navigate('/admin', { state: { section } })} />
        </div>
      ) : (
        <SettingsPage
          key={renderTab}
          initialTab={renderTab}
          standalone
          onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
        />
      )}
    </HubShell>
  );
}