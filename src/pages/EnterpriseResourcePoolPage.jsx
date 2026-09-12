import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wrench, Truck, Users, ArrowRightLeft, Search, Loader2, ArrowRight } from 'lucide-react';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import LoanResourceDrawer from '@/components/enterprise/LoanResourceDrawer';
import { useToast } from '@/components/ui/use-toast';

export default function EnterpriseResourcePoolPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('rigs');
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [loanTarget, setLoanTarget] = useState(null);

  const { data: divisions = [] } = useQuery({ queryKey: ['divisions'], queryFn: () => base44.entities.Division.list() });
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['cross-div-assets'],
    queryFn: () => base44.entities.SiteAsset.filter({ is_active: true }, '-created_date', 500),
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['cross-div-vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['cross-div-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: assignments = [] } = useQuery({
    queryKey: ['cross-div-assignments'],
    queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['cross-div-jobs'], queryFn: () => base44.entities.Job.list('-created_date', 500) });

  const today = new Date().toISOString().split('T')[0];
  const activeJobIds = new Set(jobs.filter(j => j.status === 'in_progress').map(j => j.id));
  const assignedAssetIds = new Set(assignments.filter(a => a.assigned_date === today && a.rig_asset_id).map(a => a.rig_asset_id));
  const assignedVehicleIds = new Set(assignments.filter(a => a.assigned_date === today && a.vehicle_id).map(a => a.vehicle_id));
  const assignedStaffIds = new Set(assignments.filter(a => a.assigned_date === today && a.assignment_type === 'job').map(a => a.staff_id));

  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d])), [divisions]);

  const idleRigs = assets.filter(a => a.is_rig && !assignedAssetIds.has(a.id));
  const idleVehicles = vehicles.filter(v => !assignedVehicleIds.has(v.id));
  const idleStaff = staff.filter(s => !assignedStaffIds.has(s.id) && s.worker_type === 'direct_employee');

  const tabs = [
    { key: 'rigs', label: 'Idle Rigs', icon: Wrench, count: idleRigs.length, items: idleRigs, type: 'rig' },
    { key: 'vehicles', label: 'Idle Vehicles', icon: Truck, count: idleVehicles.length, items: idleVehicles, type: 'vehicle' },
    { key: 'crews', label: 'Available Crew', icon: Users, count: idleStaff.length, items: idleStaff, type: 'staff' },
  ];
  const currentTab = tabs.find(t => t.key === tab);

  const filtered = useMemo(() => {
    return currentTab.items.filter(item => {
      if (divFilter !== 'all' && item.division_id !== divFilter) return false;
      const name = item.name || item.fleet_number || `${item.make || ''} ${item.model || ''}`.trim();
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [currentTab, divFilter, search]);

  const handleLoan = async (resourceId, resourceType, resourceDivisionId, targetDivisionId) => {
    if (!targetDivisionId) {
      toast({ title: 'Select a target division', variant: 'destructive' });
      return;
    }
    if (resourceType === 'rig') {
      await base44.entities.SiteAsset.update(resourceId, { division_id: targetDivisionId });
    } else if (resourceType === 'vehicle') {
      await base44.entities.Vehicle.update(resourceId, { division_id: targetDivisionId });
    } else if (resourceType === 'staff') {
      await base44.entities.Staff.update(resourceId, { division_id: targetDivisionId });
    }
    const targetDiv = divMap[targetDivisionId];
    toast({ title: 'Resource loaned', description: `Transferred to ${targetDiv?.name || 'target division'}.` });
  };

  return (
    <EnterpriseHubShell
      title="Resource Pool"
      subtitle="Idle resources available for cross-division loan"
      icon={ArrowRightLeft}
      accent="#6366f1"
    >
      {/* Sticky controls */}
      <div className="hub-glass rounded-2xl p-3 sm:p-4 sticky top-2 z-20">
        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  tab === t.key ? 'command-gradient text-white glow-brand' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.key ? 'bg-white/20' : 'bg-white'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${currentTab.label.toLowerCase()}…`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <select
            value={divFilter}
            onChange={e => setDivFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All Divisions</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Resource cards */}
      {assetsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">No idle {currentTab.label.toLowerCase()} match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {filtered.map(item => (
            <ResourceCard
              key={item.id}
              item={item}
              divMap={divMap}
              type={currentTab.type}
              onLoan={() => setLoanTarget(item)}
            />
          ))}
        </div>
      )}

      {/* Loan drawer */}
      {loanTarget && (
        <LoanResourceDrawer
          resource={loanTarget}
          resourceType={currentTab.type}
          divisions={divisions}
          currentDivisionId={loanTarget.division_id}
          onLoan={handleLoan}
          onClose={() => setLoanTarget(null)}
        />
      )}
    </EnterpriseHubShell>
  );
}

function ResourceCard({ item, divMap, type, onLoan }) {
  const div = divMap[item.division_id];
  const divColor = div?.color || '#94a3b8';
  const divName = div?.name || 'Unassigned';
  const name = item.name || item.fleet_number || `${item.make || ''} ${item.model || ''}`.trim() || 'Unknown';
  const subtitle = [
    type === 'rig' && item.rig_type?.toUpperCase(),
    item.asset_type && type !== 'staff' && item.asset_type,
    item.registration_number,
    item.job_title && type === 'staff' && item.job_title,
  ].filter(Boolean).join(' · ');

  return (
    <div className="hub-glass rounded-2xl p-3 sm:p-4 flex items-center gap-3">
      <span className="w-2.5 h-14 rounded-full flex-shrink-0" style={{ background: divColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: divColor }} />
          {divName}
          {subtitle && <span className="text-slate-400">· {subtitle}</span>}
        </p>
      </div>
      <button
        onClick={onLoan}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-primary hover:text-white text-slate-700 text-xs font-bold transition flex-shrink-0"
      >
        Loan <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}