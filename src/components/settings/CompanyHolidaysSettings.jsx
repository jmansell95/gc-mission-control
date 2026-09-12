import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CalendarDays, Plus, Trash2, RefreshCw, Loader2, PartyPopper,
  Building2, CheckCircle2, X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * CompanyHolidaysSettings — unified settings for UK bank holidays and custom
 * shutdown periods (Christmas, summer, etc.). Shown as a tab inside the
 * Absence Management page.
 *
 * - Bank Holidays: sync from gov.uk + list upcoming dates
 * - Shutdown Periods: add/edit/delete configurable date ranges that show on
 *   the rota for all (or direct-employee-only) staff
 */
export default function CompanyHolidaysSettings() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [form, setForm] = useState({ name: '', label: '', start_date: '', end_date: '', applies_to: 'direct_employee' });

  const { data: bankHolidays = [] } = useQuery({
    queryKey: ['bank-holidays'],
    queryFn: () => base44.entities.BankHoliday.list('holiday_date', 200),
  });
  const { data: shutdowns = [] } = useQuery({
    queryKey: ['shutdown-periods'],
    queryFn: () => base44.entities.ShutdownPeriod.list('-start_date', 100),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcomingHolidays = bankHolidays.filter(b => b.holiday_date >= today).slice(0, 8);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await base44.functions.invoke('syncBankHolidays', {});
      const d = res?.data || res;
      setSyncMsg({ ok: true, text: d.message || `Synced ${d.synced ?? d.count ?? 0} bank holidays.` });
      queryClient.invalidateQueries({ queryKey: ['bank-holidays'] });
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) return;
    await base44.entities.ShutdownPeriod.create({
      ...form,
      label: form.label || form.name,
      is_active: true,
    });
    setForm({ name: '', label: '', start_date: '', end_date: '', applies_to: 'direct_employee' });
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['shutdown-periods'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shutdown period? It will no longer show on the rota.')) return;
    await base44.entities.ShutdownPeriod.delete(id);
    queryClient.invalidateQueries({ queryKey: ['shutdown-periods'] });
  };

  const handleToggle = async (s) => {
    await base44.entities.ShutdownPeriod.update(s.id, { is_active: !s.is_active });
    queryClient.invalidateQueries({ queryKey: ['shutdown-periods'] });
  };

  return (
    <div className="space-y-6">
      {/* ── Bank Holidays ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">UK Bank Holidays</h3>
              <p className="text-xs text-slate-500">Auto-shown on the rota for everyone · {bankHolidays.length} dates loaded</p>
            </div>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing…' : 'Sync from gov.uk'}
          </button>
        </div>

        {syncMsg && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${syncMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {syncMsg.text}
          </div>
        )}

        {upcomingHolidays.length === 0 ? (
          <div className="hub-glass rounded-xl p-5 text-center text-sm text-slate-400">
            No upcoming bank holidays. Click "Sync from gov.uk" to load them.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {upcomingHolidays.map(bh => (
              <div key={bh.id} className="hub-glass rounded-xl px-3.5 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{bh.name}</p>
                  <p className="text-xs text-slate-400">{format(new Date(bh.holiday_date + 'T00:00:00'), 'EEEE dd MMM yyyy')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Shutdown Periods ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Shutdown Periods</h3>
              <p className="text-xs text-slate-500">Christmas break, annual shutdown — shown on the rota automatically</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Shutdown
          </button>
        </div>

        {shutdowns.length === 0 ? (
          <div className="hub-glass rounded-xl p-5 text-center text-sm text-slate-400">
            No shutdown periods configured. Add a Christmas shutdown or annual break to show it on everyone's rota automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {shutdowns.map(s => (
              <div key={s.id} className="hub-glass rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.is_active !== false ? 'bg-purple-100' : 'bg-slate-100'}`}>
                  <PartyPopper className={`w-4 h-4 ${s.is_active !== false ? 'text-purple-600' : 'text-slate-400'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.label || s.name}</p>
                    {s.is_active === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-bold">INACTIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    {format(new Date(s.start_date + 'T00:00:00'), 'dd MMM')} – {format(new Date(s.end_date + 'T00:00:00'), 'dd MMM yyyy')}
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-0.5">
                      <Building2 className="w-3 h-3" />
                      {s.applies_to === 'all' ? 'All staff' : 'Direct employees only'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggle(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${s.is_active !== false ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                    {s.is_active !== false ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Shutdown Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setForm({ name: '', label: '', start_date: '', end_date: '', applies_to: 'direct_employee' }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Shutdown Period</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                placeholder="e.g. Christmas Shutdown 2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rota Label</label>
              <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Christmas Break (shown on the rota)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              <p className="text-[10px] text-slate-400 mt-1">Defaults to the name if left blank.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Applies To</label>
              <select value={form.applies_to} onChange={e => setForm({ ...form, applies_to: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="direct_employee">Direct employees only</option>
                <option value="all">All staff (including subcontractors & agency)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}