import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { HardHat, Send, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import SubcontractorLogForm from '@/components/staff/SubcontractorLogForm';
import SubconDelayReport from '@/components/subcontractors/SubconDelayReport';
import SyncHUD from '@/components/staff/SyncHUD';
import WeeklyProgress from '@/components/staff/WeeklyProgress';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import FieldPageShell from '@/components/field/FieldPageShell';
import StaffHeaderActions from '@/components/field/StaffHeaderActions';

// Subcontractor "Lite" portal — a minimalist daily logging interface.
// Subcontractors log their day (including metres drilled), see their weekly
// progress, and trust the Sync HUD that their data reached the office.
export default function SubcontractorDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        const profile = res.data;
        if (profile && profile.id) setStaff(profile);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    loadStaff();
  }, []);

  const { data: jobs = [] } = useQuery({
    queryKey: ['subcon-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  const { data: sentLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['subcon-logs', staff?.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ staff_id: staff.id, crew_type: 'subcontractor' }),
    enabled: !!staff?.id,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-[#2E5A1A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">No profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact the office to get set up.</p>
        </div>
      </div>
    );
  }

  const recentLogs = [...sentLogs]
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 10);

  const meterageToday = sentLogs
    .filter(l => l.date === format(new Date(), 'yyyy-MM-dd') && (l.units_label || '').includes('metre'))
    .reduce((sum, l) => sum + (l.units_completed || 0), 0);

  return (
    <FieldPageShell
      title="Subcontractor Portal"
      subtitle={`Welcome, ${staff.name.split(' ')[0]}`}
      icon={HardHat}
      onBack={() => navigate('/staff-schedule')}
      actions={<StaffHeaderActions staff={staff} />}
    >
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Sync HUD — persistent confidence indicator */}
        <SyncHUD />

        {/* Weekly progress counter */}
        <WeeklyProgress staffId={staff.id} />

        {/* Today's meterage highlight */}
        {meterageToday > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg tabular-nums">{meterageToday.toFixed(1)}m</p>
              <p className="text-blue-50 text-xs">drilled today</p>
            </div>
          </div>
        )}

        {/* Subcontractor delay reporting */}
        <SubconDelayReport staff={staff} jobs={jobs} />

        {/* Log My Day form */}
        <SubcontractorLogForm staffId={staff.id} staffName={staff.name} jobs={jobs} />

        {/* Sent logs */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Send className="w-4 h-4 text-slate-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-700">Sent Logs</h2>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{sentLogs.length}</span>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-8 text-center">
              <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No logs sent yet. Log your day above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(log => {
                const job = jobs.find(j => j.id === log.job_id);
                const isMeters = (log.units_label || '').includes('metre');
                const statusColor = log.manager_review_status === 'approved' ? 'emerald' : log.manager_review_status === 'queried' ? 'red' : 'amber';
                return (
                  <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-700 capitalize">{(log.log_type || '').replace(/_/g, ' ')}</span>
                          {log.borehole_ref && <span className="text-xs font-mono font-bold text-slate-600">{log.borehole_ref}</span>}
                          {isMeters && log.units_completed != null && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{log.units_completed}m</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{job?.name || '—'}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{log.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${statusColor === 'emerald' ? 'bg-emerald-50 text-emerald-700' : statusColor === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {log.manager_review_status === 'approved' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                          {log.manager_review_status || 'pending'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {log.date ? format(new Date(log.date), 'dd MMM') : ''}
                          {log.created_at ? ` · ${format(new Date(log.created_at), 'HH:mm')}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </FieldPageShell>
  );
}