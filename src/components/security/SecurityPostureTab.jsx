import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, Lock, Users, Activity, Database, FileClock,
  CheckCircle2, AlertTriangle, Server, KeyRound, Eye,
} from 'lucide-react';

export default function SecurityPostureTab() {
  const { data: staff = [] } = useQuery({
    queryKey: ['security-posture-staff'],
    queryFn: () => base44.entities.Staff.list(500),
    staleTime: 60000,
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['security-posture-audit'],
    queryFn: () => base44.entities.SystemAuditLog.list('-created_date', 10),
    staleTime: 30000,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ['security-posture-divisions'],
    queryFn: () => base44.entities.Division.list(500),
    staleTime: 60000,
  });

  const usersWithAccess = staff.filter(s => s.user_id || s.is_admin);
  const adminCount = staff.filter(s => s.system_role === 'admin' || s.system_role === 'super_admin' || s.is_admin).length;
  const activeCount = staff.filter(s => s.is_active !== false).length;
  const inactiveCount = staff.length - activeCount;

  const postureItems = [
    {
      icon: Lock,
      title: 'Authentication',
      status: 'mitigated',
      value: 'Microsoft SSO',
      detail: 'No local passwords. MFA enforced by corporate Microsoft tenant. Invite-only — no self-registration.',
    },
    {
      icon: KeyRound,
      title: 'Access Control',
      status: 'mitigated',
      value: `${usersWithAccess.length} users`,
      detail: `${adminCount} admins, ${activeCount} active staff, ${inactiveCount} inactive. RLS on all entities. Admin-only settings.`,
    },
    {
      icon: FileClock,
      title: 'Audit Logging',
      status: 'mitigated',
      value: `${auditLogs.length}+ recent`,
      detail: 'SystemAuditLog records all settings changes. FinancialAuditLog records financial mutations. Entity audit trails on every record.',
    },
    {
      icon: Database,
      title: 'Backup & Recovery',
      status: 'mitigated',
      value: 'Automated',
      detail: 'Automated backup schedule (BackupSchedule). Manual backup/restore via BackupRestoreHub. Division-level snapshots.',
    },
    {
      icon: Server,
      title: 'Code & Version Control',
      status: 'mitigated',
      value: 'GitHub Sync',
      detail: '2-way GitHub sync available. Full commit history. Draft/published separation. Admin-only publishing.',
    },
    {
      icon: Eye,
      title: 'Monitoring',
      status: 'mitigated',
      value: 'Real-time',
      detail: 'Real-time entity subscriptions. SystemAuditLog. Dashboard logs explorer. Integration health monitoring.',
    },
    {
      icon: ShieldCheck,
      title: 'Security Scan',
      status: 'partial',
      value: 'Dashboard',
      detail: 'Security scan available in dashboard → Security page. Run periodically and address findings.',
    },
    {
      icon: Server,
      title: 'Platform Security',
      status: 'partial',
      value: 'Base44-managed',
      detail: 'Base44 manages platform updates and security. Admin should verify vendor security posture and data residency.',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Posture cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {postureItems.map((item, i) => {
          const Icon = item.icon;
          const isMitigated = item.status === 'mitigated';
          return (
            <div key={i} className="hub-glass rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isMitigated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                    {isMitigated
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs font-bold text-slate-700 mb-1">{item.value}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent audit log entries */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-600" />
          <h4 className="font-bold text-sm text-slate-900">Recent System Audit Entries</h4>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No audit log entries yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/50 border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{log.action || log.entity_name || 'System change'}</p>
                  <p className="text-[10px] text-slate-400">
                    {log.performed_by_name || 'System'} · {log.created_date ? new Date(log.created_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Org structure */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-slate-600" />
          <h4 className="font-bold text-sm text-slate-900">Organisation Structure</h4>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{divisions.filter(d => !d.parent_division_id).length}</p>
            <p className="text-[10px] text-slate-500 font-medium">Business Units</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{divisions.filter(d => d.parent_division_id).length}</p>
            <p className="text-[10px] text-slate-500 font-medium">Streams</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{staff.length}</p>
            <p className="text-[10px] text-slate-500 font-medium">Staff</p>
          </div>
        </div>
      </div>
    </div>
  );
}