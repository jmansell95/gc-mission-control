import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wrench, Truck, Users, ArrowRightLeft, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * CrossDivisionResourceBoard — enterprise-level view showing idle rigs,
 * vehicles and crews across all divisions. Managers can loan a resource
 * from one division to another without leaving the enterprise dashboard.
 */
export default function CrossDivisionResourceBoard() {
  const { toast } = useToast();
  const [tab, setTab] = useState('rigs');
  const [loaning, setLoaning] = useState(null);

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

  const divMap = Object.fromEntries(divisions.map(d => [d.id, d]));

  const idleRigs = assets.filter(a => a.is_rig && !assignedAssetIds.has(a.id));
  const idleVehicles = vehicles.filter(v => !assignedVehicleIds.has(v.id));
  const idleStaff = staff.filter(s => !assignedStaffIds.has(s.id) && s.worker_type === 'direct_employee');

  const tabs = [
    { key: 'rigs', label: 'Idle Rigs', icon: Wrench, count: idleRigs.length, items: idleRigs, type: 'rig' },
    { key: 'vehicles', label: 'Idle Vehicles', icon: Truck, count: idleVehicles.length, items: idleVehicles, type: 'vehicle' },
    { key: 'crews', label: 'Available Crew', icon: Users, count: idleStaff.length, items: idleStaff, type: 'staff' },
  ];

  const currentTab = tabs.find(t => t.key === tab);

  const handleLoan = async (resourceId, resourceType, resourceDivisionId, targetDivisionId) => {
    if (!targetDivisionId) {
      toast({ title: 'Select a target division', variant: 'destructive' });
      return;
    }
    setLoaning(resourceId);
    try {
      if (resourceType === 'rig') {
        await base44.entities.SiteAsset.update(resourceId, { division_id: targetDivisionId });
      } else if (resourceType === 'vehicle') {
        await base44.entities.Vehicle.update(resourceId, { division_id: targetDivisionId });
      } else if (resourceType === 'staff') {
        await base44.entities.Staff.update(resourceId, { division_id: targetDivisionId });
      }
      const targetDiv = divMap[targetDivisionId];
      toast({ title: 'Resource loaned', description: `Transferred to ${targetDiv?.name || 'target division'}.` });
    } catch (err) {
      toast({ title: 'Transfer failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoaning(null);
    }
  };

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Cross-Division Resource Pool</h3>
          <p className="text-xs text-slate-500">Idle resources available for loan across divisions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
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

      {/* Resource list */}
      {assetsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : currentTab.items.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          No idle {currentTab.label.toLowerCase()} — all resources are deployed.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {currentTab.items.slice(0, 20).map(item => {
            const divName = divMap[item.division_id]?.name || 'Unassigned';
            const divColor = divMap[item.division_id]?.color || '#94a3b8';
            const name = item.name || item.fleet_number || `${item.make || ''} ${item.model || ''}`.trim() || 'Unknown';
            return (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: divColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: divColor }} />
                    {divName}
                    {item.asset_type === 'rig' && ` · ${item.rig_type?.toUpperCase() || ''}`}
                    {item.registration_number && ` · ${item.registration_number}`}
                  </p>
                </div>
                <select
                  onChange={(e) => handleLoan(item.id, currentTab.type, item.division_id, e.target.value)}
                  disabled={loaning === item.id}
                  defaultValue=""
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
                >
                  <option value="" disabled>Loan to…</option>
                  {divisions.filter(d => d.id !== item.division_id).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {currentTab.items.length > 20 && (
            <p className="text-xs text-center text-slate-400 pt-2">
              +{currentTab.items.length - 20} more…
            </p>
          )}
        </div>
      )}
    </div>
  );
}