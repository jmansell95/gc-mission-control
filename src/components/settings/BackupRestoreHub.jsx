import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Database, Download, RotateCcw, Plus, Trash2, Loader2, CheckCircle2,
  AlertTriangle, Clock, Shield, FileJson, History, X, Search,
  CalendarClock, Repeat, Power, PowerOff,
} from 'lucide-react';

const TYPE_STYLES = {
  manual: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', label: 'Manual', dot: 'bg-blue-500' },
  automatic: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Automatic', dot: 'bg-emerald-500' },
  pre_flight: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Pre-Flight', dot: 'bg-amber-500' },
};

const STATUS_STYLES = {
  creating: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Creating…' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  failed: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Failed' },
  restored: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Restored' },
};

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function BackupRestoreHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [filterDivision, setFilterDivision] = useState('all');
  const [search, setSearch] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ division_id: '', frequency: 'daily', backup_time: '02:00', weekly_day: 1, retention_count: 14, cron_expression: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [togglingSchedule, setTogglingSchedule] = useState(null);

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['division-snapshots'],
    queryFn: () => base44.entities.DivisionSnapshot.list('-created_date', 200),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['backup-schedules'],
    queryFn: () => base44.entities.BackupSchedule.list('-created_date', 100),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['division-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['divisions'] });
    queryClient.invalidateQueries({ queryKey: ['backup-schedules'] });
  };

  const handleCreateSchedule = async () => {
    setSavingSchedule(true);
    try {
      const div = scheduleForm.division_id
        ? divisions.find(d => d.id === scheduleForm.division_id)
        : null;
      const payload = {
        division_id: scheduleForm.division_id || '',
        division_name: div?.name || 'All Business Streams',
        frequency: scheduleForm.frequency,
        backup_time: scheduleForm.backup_time,
        weekly_day: scheduleForm.frequency === 'weekly' ? scheduleForm.weekly_day : undefined,
        cron_expression: scheduleForm.frequency === 'custom' ? scheduleForm.cron_expression : '',
        retention_count: Number(scheduleForm.retention_count) || 14,
        is_active: true,
        created_by_name: 'Admin',
      };
      await base44.entities.BackupSchedule.create(payload);
      toast({ title: 'Schedule created', description: `${scheduleForm.frequency} backup scheduled for ${div?.name || 'all divisions'}.` });
      setShowScheduleForm(false);
      setScheduleForm({ division_id: '', frequency: 'daily', backup_time: '02:00', weekly_day: 1, retention_count: 14, cron_expression: '' });
      invalidate();
    } catch (e) {
      toast({ title: 'Failed to create schedule', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (schedule) => {
    setTogglingSchedule(schedule.id);
    try {
      await base44.entities.BackupSchedule.update(schedule.id, { is_active: !schedule.is_active });
      invalidate();
      toast({ title: schedule.is_active ? 'Schedule paused' : 'Schedule activated' });
    } catch (e) {
      toast({ title: 'Failed to toggle schedule', description: e.message, variant: 'destructive' });
    } finally {
      setTogglingSchedule(null);
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    try {
      await base44.entities.BackupSchedule.delete(schedule.id);
      invalidate();
      toast({ title: 'Schedule deleted' });
    } catch (e) {
      toast({ title: 'Failed to delete schedule', description: e.message, variant: 'destructive' });
    }
  };

  const handleBackup = async (divisionId, divisionName) => {
    setCreating(divisionId);
    try {
      const res = await base44.functions.invoke('backupDivision', { division_id: divisionId, snapshot_type: 'manual' });
      toast({
        title: 'Snapshot created',
        description: `${divisionName}: ${res.data.total_records} records captured (${formatBytes(res.data.file_size_bytes)})`,
      });
      invalidate();
    } catch (e) {
      toast({ title: 'Backup failed', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(null);
    }
  };

  const handleRestore = async (snapshot) => {
    setRestoring(snapshot.id);
    try {
      const res = await base44.functions.invoke('restoreDivision', { snapshot_id: snapshot.id });
      toast({
        title: 'Restore complete',
        description: res.data.message,
      });
      invalidate();
    } catch (e) {
      toast({ title: 'Restore failed', description: e.message, variant: 'destructive' });
    } finally {
      setRestoring(null);
      setConfirmRestore(null);
    }
  };

  const handleDownload = async (snapshot) => {
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: snapshot.file_uri,
        expires_in: 300,
      });
      window.open(res.signed_url, '_blank');
    } catch (e) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (snapshot) => {
    setDeleting(snapshot.id);
    try {
      await base44.entities.DivisionSnapshot.delete(snapshot.id);
      toast({ title: 'Snapshot deleted' });
      invalidate();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const filteredSnapshots = useMemo(() => {
    let result = snapshots;
    if (filterDivision !== 'all') {
      result = result.filter(s => s.division_id === filterDivision);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        (s.division_name || '').toLowerCase().includes(q) ||
        (s.trigger_reason || '').toLowerCase().includes(q) ||
        (s.created_by_name || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [snapshots, filterDivision, search]);

  const stats = useMemo(() => {
    const completed = snapshots.filter(s => s.status === 'completed');
    const totalRecords = completed.reduce((sum, s) => sum + (s.total_records || 0), 0);
    const totalSize = completed.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0);
    return { count: completed.length, totalRecords, totalSize };
  }, [snapshots]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-md flex-shrink-0">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-slate-900">Backup & Restore</h2>
            <p className="text-sm text-slate-500">
              Create checkpoints of each division's data and configuration. Restore rolls back division settings to a previous checkpoint — a safety backup is created automatically before every restore.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 flex-shrink-0">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-700">Super Admin Only</span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <History className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{stats.count}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Snapshots</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <FileJson className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{stats.totalRecords.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Records</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Database className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{formatBytes(stats.totalSize)}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Storage</p>
          </div>
        </div>
      </div>

      {/* Quick backup buttons per division */}
      <div className="hub-glass rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Quick Backup</p>
        <div className="flex flex-wrap gap-2">
          {divisions.map(d => (
            <button
              key={d.id}
              onClick={() => handleBackup(d.id, d.name)}
              disabled={creating === d.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-60 transition active:scale-95"
            >
              {creating === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span className="w-2 h-2 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Backups */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <CalendarClock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Scheduled Backups</h3>
              <p className="text-xs text-slate-500">Automatic backups on a recurring schedule</p>
            </div>
          </div>
          <button
            onClick={() => setShowScheduleForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-6">
            <Repeat className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">No schedules yet</p>
            <p className="text-xs text-slate-400 mt-1">Create a schedule to run backups automatically — daily, weekly, or custom.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(sch => {
              const div = sch.division_id ? divisions.find(d => d.id === sch.division_id) : null;
              const freqLabel = sch.frequency === 'daily' ? 'Daily' : sch.frequency === 'weekly' ? 'Weekly' : 'Custom';
              const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sch.weekly_day || 1];
              const timeLabel = sch.frequency === 'weekly' ? `${dayLabel} ${sch.backup_time || '02:00'}` : sch.frequency === 'custom' ? (sch.cron_expression || 'cron') : (sch.backup_time || '02:00');
              return (
                <div key={sch.id} className={'flex items-center gap-3 p-3 rounded-xl border transition ' + (sch.is_active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60')}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: div?.color || '#2E5A1A' }}>
                    <CalendarClock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{sch.division_name || 'All Business Streams'}</span>
                      <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ' + (sch.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')}>
                        {sch.is_active ? <Power className="w-2.5 h-2.5" /> : <PowerOff className="w-2.5 h-2.5" />}
                        {sch.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold">{freqLabel}</span>
                      <span className="text-slate-300">·</span>
                      <span className="tabular-nums">{timeLabel}</span>
                      <span className="text-slate-300">·</span>
                      <span>Keep {sch.retention_count || 14}</span>
                      {sch.last_run_at && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>Last: {timeAgo(sch.last_run_at)}</span>
                          {sch.last_run_status === 'failed' && <span className="text-rose-500 font-semibold">failed</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggleSchedule(sch)}
                      disabled={togglingSchedule === sch.id}
                      title={sch.is_active ? 'Pause schedule' : 'Activate schedule'}
                      className={'p-2 rounded-lg transition ' + (sch.is_active ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600')}
                    >
                      {togglingSchedule === sch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : sch.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(sch)}
                      title="Delete schedule"
                      className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule creation modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 z-[60] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !savingSchedule && setShowScheduleForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">New Backup Schedule</h3>
                  <p className="text-xs text-slate-500">Runs automatically on a recurring basis</p>
                </div>
              </div>
              <button onClick={() => setShowScheduleForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Division */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Business Stream</label>
                <select
                  value={scheduleForm.division_id}
                  onChange={e => setScheduleForm(f => ({ ...f, division_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary"
                >
                  <option value="">All Business Streams</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {['daily', 'weekly', 'custom'].map(f => (
                    <button
                      key={f}
                      onClick={() => setScheduleForm(s => ({ ...s, frequency: f }))}
                      className={'px-3 py-2.5 rounded-xl text-sm font-bold capitalize transition ' + (scheduleForm.frequency === f ? 'bg-primary text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              {scheduleForm.frequency !== 'custom' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Time (24h)</label>
                  <input
                    type="time"
                    value={scheduleForm.backup_time}
                    onChange={e => setScheduleForm(f => ({ ...f, backup_time: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Weekly day */}
              {scheduleForm.frequency === 'weekly' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Day of Week</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <button
                        key={i}
                        onClick={() => setScheduleForm(f => ({ ...f, weekly_day: i }))}
                        className={'py-2 rounded-lg text-xs font-bold transition ' + (scheduleForm.weekly_day === i ? 'bg-primary text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100')}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cron expression */}
              {scheduleForm.frequency === 'custom' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Cron Expression</label>
                  <input
                    type="text"
                    value={scheduleForm.cron_expression}
                    onChange={e => setScheduleForm(f => ({ ...f, cron_expression: e.target.value }))}
                    placeholder="0 2 * * 1-5"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-700 focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">e.g. "0 2 * * 1-5" = 2am Mon-Fri</p>
                </div>
              )}

              {/* Retention */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Retention (snapshots to keep)</label>
                <input
                  type="number"
                  value={scheduleForm.retention_count}
                  onChange={e => setScheduleForm(f => ({ ...f, retention_count: e.target.value }))}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-slate-400 mt-1">Older snapshots beyond this count are automatically deleted.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowScheduleForm(false)} disabled={savingSchedule} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-60">Cancel</button>
              <button
                onClick={handleCreateSchedule}
                disabled={savingSchedule}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 disabled:opacity-60 transition"
              >
                {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by division, reason or creator…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <select
          value={filterDivision}
          onChange={e => setFilterDivision(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary"
        >
          <option value="all">All Business Streams</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Snapshots list */}
      {isLoading ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
      ) : filteredSnapshots.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No snapshots yet</p>
          <p className="text-xs text-slate-400 mt-1">Create a backup using the Quick Backup buttons above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSnapshots.map(s => {
            const typeStyle = TYPE_STYLES[s.snapshot_type] || TYPE_STYLES.manual;
            const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.creating;
            const div = divisions.find(d => d.id === s.division_id);
            const counts = (() => { try { return JSON.parse(s.entity_counts || '{}'); } catch { return {}; } })();
            const isCreating = s.status === 'creating';
            const isRestoring = restoring === s.id;

            return (
              <div key={s.id} className="hub-glass rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  {/* Division color dot */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${div?.color || '#2E5A1A'}, ${div?.color || '#2E5A1A'}cc)` }}>
                    <Database className="w-5 h-5 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-extrabold text-slate-900">{s.division_name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${typeStyle.bg} ${typeStyle.text} ring-1 ${typeStyle.ring}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} /> {typeStyle.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>
                        {isCreating && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {statusStyle.label}
                      </span>
                    </div>

                    {s.trigger_reason && (
                      <p className="text-xs text-slate-500 mb-1.5 truncate">{s.trigger_reason}</p>
                    )}

                    {/* Entity counts */}
                    {Object.keys(counts).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {Object.entries(counts).map(([name, count]) => (
                          <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500">
                            {name}: <span className="text-slate-700 tabular-nums">{count}</span>
                          </span>
                        ))}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
                          Total: <span className="tabular-nums">{s.total_records || 0}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400">
                          {formatBytes(s.file_size_bytes)}
                        </span>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(s.created_date)}</span>
                      <span className="text-slate-300">·</span>
                      <span>{s.created_by_name}</span>
                      {s.restored_at && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-indigo-500 font-semibold">restored {timeAgo(s.restored_at)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.status === 'completed' && (
                      <>
                        <button
                          onClick={() => handleDownload(s)}
                          title="Download backup file"
                          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmRestore(s)}
                          disabled={isRestoring}
                          title="Restore from this checkpoint"
                          className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition disabled:opacity-60"
                        >
                          {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deleting === s.id}
                      title="Delete snapshot"
                      className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-60"
                    >
                      {deleting === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Restore confirmation modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-[60] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !restoring && setConfirmRestore(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Restore Business Stream?</h3>
                <p className="text-xs text-slate-500">This will roll back the division's configuration.</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                <Database className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">{confirmRestore.division_name}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Snapshot from {timeAgo(confirmRestore.created_date)}</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">A safety backup of the current state will be created automatically before the restore — so you can undo this if needed.</p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Restore rolls back the division's <strong>configuration</strong> (settings, hubs, navigation). Operational data (jobs, rotas, timesheets) is not overwritten — download the backup file for a full data export.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRestore(null)} disabled={restoring} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-60">Cancel</button>
              <button onClick={() => handleRestore(confirmRestore)} disabled={restoring} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold shadow-md hover:bg-amber-700 disabled:opacity-60 transition">
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}