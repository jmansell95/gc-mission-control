import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import { complianceDaysUntil } from '@/utils/complianceDate';

export default function CrewCertificationPulseWidget() {
  const { data: complianceItems = [], isLoading } = useQuery({
    queryKey: ['compliance-items-pulse'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-pulse'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const activeStaff = staff.filter(s => s.is_active !== false);

  let expired = 0, expiringSoon = 0, valid = 0;
  complianceItems.forEach(item => {
    if (!item.expiry_date || item.status_override !== 'auto') { valid++; return; }
    const days = complianceDaysUntil(item.expiry_date);
    if (days === null) { valid++; return; }
    if (days < 0) expired++;
    else if (days <= 30) expiringSoon++;
    else valid++;
  });

  const total = expired + expiringSoon + valid;
  const compliancePct = total > 0 ? Math.round((valid / total) * 100) : 0;

  const stats = [
    { label: 'Valid', count: valid, icon: CheckCircle2, gradient: 'stat-gradient-emerald' },
    { label: 'Expiring Soon', count: expiringSoon, icon: AlertTriangle, gradient: 'stat-gradient-amber' },
    { label: 'Expired', count: expired, icon: XCircle, gradient: 'stat-gradient-rose' },
  ];

  if (isLoading) return <HubLoadingState variant="stats" count={3} />;

  return (
    <HubCard icon={ShieldCheck} title="Crew Certification Pulse" subtitle={`${activeStaff.length} active crew · ${compliancePct}% compliant`} tone="blue">
      <div className="space-y-3">
        {total > 0 && (
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            {valid > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(valid / total) * 100}%` }} />}
            {expiringSoon > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${(expiringSoon / total) * 100}%` }} />}
            {expired > 0 && <div className="h-full bg-rose-500 transition-all" style={{ width: `${(expired / total) * 100}%` }} />}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="hub-glass rounded-2xl p-3 text-center">
                <span className={`w-8 h-8 rounded-xl ${s.gradient} flex items-center justify-center mx-auto mb-1.5 shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </span>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{s.count}</p>
                <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
              </div>
            );
          })}
        </div>

        {expired > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 font-medium">{expired} crew member{expired !== 1 ? 's' : ''} with expired certifications — cannot work on site</p>
          </div>
        )}
      </div>
    </HubCard>
  );
}