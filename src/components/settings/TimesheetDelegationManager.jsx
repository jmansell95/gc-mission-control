import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { UserCheck, Plus, X, Calendar, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Timesheet Approval Delegation — lets managers delegate their timesheet
// approval authority to another person during absences (annual leave,
// conference, sick cover). The delegate can then approve timesheets on
// the manager's behalf within the specified date range.

export default function TimesheetDelegationManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    delegating_manager_id: '',
    delegate_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Load staff for the dropdowns
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-delegation'],
    queryFn: async () => {
      const res = await base44.entities.Staff.list('-created_date', 200);
      return (res.data || res).filter(s => s.is_active !== false);
    },
  });

  // Load existing delegations
  const { data: delegations = [], isLoading } = useQuery({
    queryKey: ['timesheet-delegations'],
    queryFn: async () => {
      const res = await base44.entities.TimesheetDelegation.list('-created_date', 50);
      return res.data || res || [];
    },
  });

  const staffName = (id) => staff.find(s => s.id === id)?.name || 'Unknown';

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.TimesheetDelegation.create({
        ...data,
        delegating_manager_name: staffName(data.delegating_manager_id),
        delegate_name: staffName(data.delegate_id),
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-delegations'] });
      toast({ title: '✓ Delegation created', description: 'The delegate can now approve timesheets on the manager\'s behalf.' });
      setShowForm(false);
      setForm({ delegating_manager_id: '', delegate_id: '', start_date: '', end_date: '', reason: '' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.TimesheetDelegation.update(id, {
        is_active: false,
        revoked_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-delegations'] });
      toast({ title: 'Delegation revoked' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.TimesheetDelegation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-delegations'] });
      toast({ title: 'Delegation deleted' });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentlyActive = (d) => d.is_active && d.start_date <= today && (!d.end_date || d.end_date >= today);

  const activeCount = delegations.filter(isCurrentlyActive).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.delegating_manager_id || !form.delegate_id || !form.start_date || !form.end_date) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (form.delegating_manager_id === form.delegate_id) {
      toast({ title: 'Manager and delegate must be different people', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={UserCheck}
        title="Timesheet Approval Delegation"
        description="Delegate timesheet approval authority to another person during absences — annual leave, conferences, sick cover."
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="bg-[#2E5A1A] hover:bg-[#1c4a12] text-white">
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? 'Cancel' : 'New Delegation'}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="hub-glass rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Now</p>
        </div>
        <div className="hub-glass rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-700">{delegations.filter(d => d.is_active && d.start_date > today).length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Upcoming</p>
        </div>
        <div className="hub-glass rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-400">{delegations.filter(d => !d.is_active).length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Revoked / Expired</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="hub-glass rounded-2xl p-5 mb-5 space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Delegating Manager</label>
              <select
                value={form.delegating_manager_id}
                onChange={e => setForm({ ...form, delegating_manager_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select manager…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Delegate (approves on their behalf)</label>
              <select
                value={form.delegate_id}
                onChange={e => setForm({ ...form, delegate_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select delegate…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason (optional)</label>
            <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Annual leave, Conference, Sick cover"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" />
          </div>
          <Button type="submit" disabled={createMutation.isPending} className="bg-[#2E5A1A] hover:bg-[#1c4a12] text-white">
            {createMutation.isPending ? 'Creating…' : 'Create Delegation'}
          </Button>
        </form>
      )}

      {/* List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
        ) : delegations.length === 0 ? (
          <div className="hub-glass rounded-2xl p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No delegations yet</p>
            <p className="text-xs text-slate-400 mt-1">Create a delegation to let someone else approve timesheets during a manager's absence.</p>
          </div>
        ) : (
          delegations.map(d => {
            const active = isCurrentlyActive(d);
            const expired = d.end_date && d.end_date < today;
            return (
              <div key={d.id} className={`hub-glass rounded-xl p-4 flex items-center gap-3 ${!d.is_active ? 'opacity-60' : ''}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-emerald-100 text-emerald-700' : expired ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-600'
                }`}>
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">
                      {d.delegating_manager_name || staffName(d.delegating_manager_id)}
                    </p>
                    <span className="text-xs text-slate-400">→</span>
                    <p className="text-sm font-medium text-emerald-700">
                      {d.delegate_name || staffName(d.delegate_id)}
                    </p>
                    {active && <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>}
                    {expired && d.is_active && <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Expired</span>}
                    {!d.is_active && <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Revoked</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{d.start_date} → {d.end_date}</span>
                    {d.reason && <span>· {d.reason}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {d.is_active && (
                    <Button variant="outline" size="sm" onClick={() => revokeMutation.mutate(d.id)} className="text-amber-600 hover:text-amber-700">
                      Revoke
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(d.id)} className="text-rose-500 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}