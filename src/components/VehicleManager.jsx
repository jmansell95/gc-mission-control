import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Truck, Wrench, Weight, Link2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import { TableSkeleton } from '@/components/StateViews';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Safely parse a date string that may be YYYY-MM-DD or a full ISO timestamp.
 *  Appending 'T00:00:00' to a value that already contains 'T' produces an
 *  invalid date — this handles both shapes. */
function safeDate(val) {
  if (!val) return null;
  const s = String(val);
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

const emptyForm = {
  name: '', registration_number: '', vin: '', assigned_staff_id: '', team_id: '',
  mot_expiry: '', service_due_date: '', last_service_date: '',
  max_weight_kg: '', max_volume_m3: ''
};

function getMaintenanceStatus(vehicle) {
  const today = new Date();
  const issues = [];
  if (vehicle.mot_expiry) {
    const d = safeDate(vehicle.mot_expiry);
    if (d) {
      const days = differenceInDays(d, today);
      if (days < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days });
      else if (days <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days });
    }
  }
  if (vehicle.service_due_date) {
    const d = safeDate(vehicle.service_due_date);
    if (d) {
      const days = differenceInDays(d, today);
      if (days < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days });
      else if (days <= 30) issues.push({ label: 'Service Due', severity: 'warning', days });
    }
  }
  return issues;
}

export default function VehicleManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  const queryClient = useQueryClient();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });

  const filteredVehicles = vehicles.filter(v => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || (v.name?.toLowerCase().includes(q) || v.registration_number?.toLowerCase().includes(q));
    const matchesTeam = teamFilter === 'all' || v.team_id === teamFilter;
    return matchesSearch && matchesTeam;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await base44.entities.Vehicle.update(editingId, formData); }
    else { await base44.entities.Vehicle.create(formData); }
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    setFormData(emptyForm);
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (v) => { setFormData({ ...emptyForm, ...v }); setEditingId(v.id); setShowForm(true); };
  const handleDelete = async (id) => {
    if (confirm('Delete this vehicle?')) {
      await base44.entities.Vehicle.delete(id);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    }
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Truck}
        title="Manage Vehicles"
        description="Track vehicles, MOTs and service dates"
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        }
      />
      <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-blue-500" />
        Tip: Enter the VIN to auto-match this vehicle when syncing from Holman. Book maintenance and view live Holman telemetry on the dedicated <strong className="text-slate-700">Vehicles</strong> page.
      </p>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setFormData(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Vehicle' : 'New Vehicle'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Description *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Registration Number *</label>
              <input type="text" value={formData.registration_number} onChange={e => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm font-mono uppercase" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VIN (for Holman matching)</label>
              <input type="text" value={formData.vin || ''} onChange={e => setFormData({ ...formData, vin: e.target.value })}
                placeholder="Vehicle Identification No." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Team</label>
              <select value={formData.team_id || ''} onChange={e => setFormData({ ...formData, team_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Team (Optional)</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Staff</label>
              <select value={formData.assigned_staff_id || ''} onChange={e => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Unassigned (Optional)</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">MOT Expiry Date</label>
              <input type="date" value={formData.mot_expiry || ''} onChange={e => setFormData({ ...formData, mot_expiry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service Due Date</label>
              <input type="date" value={formData.service_due_date || ''} onChange={e => setFormData({ ...formData, service_due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Service Date</label>
              <input type="date" value={formData.last_service_date || ''} onChange={e => setFormData({ ...formData, last_service_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Weight className="w-3 h-3" /> Max Weight (kg)</label>
              <input type="number" min="0" step="1" value={formData.max_weight_kg || ''} onChange={e => setFormData({ ...formData, max_weight_kg: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="e.g. 3500" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Volume (m³)</label>
              <input type="number" min="0" step="0.1" value={formData.max_volume_m3 || ''} onChange={e => setFormData({ ...formData, max_volume_m3: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="e.g. 12.5" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm">
            {editingId ? 'Update' : 'Add'} Vehicle
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
        </DialogContent>
      </Dialog>

      {vehiclesLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No vehicles yet. Add your first vehicle above.</div>
      ) : (
        <>
          <div className="mb-5">
            <SearchFilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by reg or description..."
              showCount
              totalCount={filteredVehicles.length}
              filters={[
                {
                  value: teamFilter, onChange: setTeamFilter,
                  options: [{ value: 'all', label: 'All Teams' }, ...teams.map(t => ({ value: t.id, label: t.name }))]
                },
              ]}
            />
          </div>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-4 py-3 text-left font-semibold">Registration</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">Team</th>
                  <th className="px-4 py-3 text-left font-semibold">Assigned To</th>
                  <th className="px-4 py-3 text-left font-semibold">Capacity</th>
                  <th className="px-4 py-3 text-left font-semibold">Maintenance</th>
                  <th className="px-4 py-3 text-left font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v, idx) => {
                  const assignedStaff = staff.find(s => s.id === v.assigned_staff_id);
                  const team = teams.find(t => t.id === v.team_id);
                  const issues = getMaintenanceStatus(v);
                  return (
                    <tr key={v.id} className={`border-b border-slate-100 hover:bg-primary/5 transition ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{v.registration_number}</td>
                      <td className="px-4 py-3 text-slate-700">{v.name}</td>
                      <td className="px-4 py-3 text-slate-600">{team?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{assignedStaff?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {v.max_weight_kg || v.max_volume_m3 ? (
                          <span className="flex flex-col gap-0.5">
                            {v.max_weight_kg && <span className="flex items-center gap-1"><Weight className="w-3 h-3 text-slate-400" />{Number(v.max_weight_kg).toLocaleString()} kg</span>}
                            {v.max_volume_m3 && <span>{Number(v.max_volume_m3)} m³</span>}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {issues.length === 0 ? (
                          <span className="text-xs text-emerald-600 flex items-center gap-1"><Wrench className="w-3 h-3" /> Up to date</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {issues.map((issue, i) => (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                {issue.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(v)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(v.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet cards */}
          <div className="lg:hidden space-y-3">
            {filteredVehicles.map(v => {
              const assignedStaff = staff.find(s => s.id === v.assigned_staff_id);
              const team = teams.find(t => t.id === v.team_id);
              const issues = getMaintenanceStatus(v);
              return (
                <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-slate-900">{v.registration_number}</p>
                        <p className="text-xs text-slate-500 truncate">{v.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(v)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {team && <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{team.name}</span>}
                    {assignedStaff && <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{assignedStaff.name}</span>}
                    {!assignedStaff && <span className="bg-slate-100 text-slate-400 px-2.5 py-1 rounded-full">Unassigned</span>}
                    {issues.map((issue, i) => (
                      <span key={i} className={`px-2.5 py-1 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        {issue.label}
                      </span>
                    ))}
                    {v.max_weight_kg && <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full flex items-center gap-1"><Weight className="w-3 h-3" />{Number(v.max_weight_kg).toLocaleString()} kg</span>}
                    {v.max_volume_m3 && <span className="bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full">{Number(v.max_volume_m3)} m³</span>}
                    {issues.length === 0 && safeDate(v.mot_expiry) && <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full">MOT: {format(safeDate(v.mot_expiry), 'dd MMM yy')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}