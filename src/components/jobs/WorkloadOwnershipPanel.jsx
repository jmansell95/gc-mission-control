import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, Building2, Network } from 'lucide-react';

/**
 * Compact Workload Ownership panel — shows the Direct vs Partner split
 * and partner group breakdown. Integrated into the Manage Jobs page.
 */
export default function WorkloadOwnershipPanel() {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const clientMap = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  const partnerClientIds = useMemo(() => new Set(clients.filter(c => c.is_partner).map(c => c.id)), [clients]);
  const partnerClients = useMemo(() => clients.filter(c => c.is_partner), [clients]);

  const activeJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'planning');
  const directJobs = activeJobs.filter(j => !partnerClientIds.has(j.client_id));
  const partnerJobs = activeJobs.filter(j => partnerClientIds.has(j.client_id));

  const total = activeJobs.length || 1;
  const directPct = Math.round((directJobs.length / total) * 100);

  const groupedPartners = useMemo(() => {
    const groups = {};
    const standalone = [];

    partnerClients.forEach(c => {
      if (c.parent_client_id && clientMap[c.parent_client_id]) {
        const parentId = c.parent_client_id;
        if (!groups[parentId]) groups[parentId] = { parent: clientMap[parentId], children: [] };
        groups[parentId].children.push(c);
      } else {
        standalone.push(c);
      }
    });

    const breakdown = [];
    Object.values(groups)
      .map(g => ({ ...g, totalCount: g.children.reduce((s, c) => s + partnerJobs.filter(j => j.client_id === c.id).length, 0) }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .forEach(g => {
        breakdown.push({
          id: g.parent.id, name: g.parent.name, color: g.parent.partner_color || '#2563eb',
          count: g.totalCount, isGroup: true,
          children: g.children.map(c => ({ id: c.id, name: c.name, color: c.partner_color || '#2563eb', count: partnerJobs.filter(j => j.client_id === c.id).length }))
            .filter(c => c.count > 0).sort((a, b) => b.count - a.count),
        });
      });

    standalone.forEach(c => {
      const count = partnerJobs.filter(j => j.client_id === c.id).length;
      if (count > 0) breakdown.push({ id: c.id, name: c.name, color: c.partner_color || '#2563eb', count, isGroup: false });
    });

    return breakdown.filter(p => p.count > 0).sort((a, b) => b.count - a.count);
  }, [partnerClients, partnerJobs, clientMap]);

  if (activeJobs.length === 0) return null;

  return (
    <div className="mb-5 hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
          <Network className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Workload Ownership</h3>
        <span className="text-xs text-slate-400">Direct vs Partner split</span>
      </div>

      {/* Split bar */}
      <div className="flex h-7 rounded-lg overflow-hidden shadow-sm mb-3">
        <div
          className="flex items-center justify-center bg-gradient-to-r from-[#2E5A1A] to-[#4d7c2a] text-white text-xs font-bold transition-all"
          style={{ width: `${directPct}%` }}
          title={`${directJobs.length} direct jobs`}
        >
          {directPct > 12 && <span className="px-2">{directJobs.length} Direct</span>}
        </div>
        {groupedPartners.map(p => {
          const pct = Math.round((p.count / total) * 100);
          if (pct === 0) return null;
          return (
            <div key={p.id} className="flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} title={`${p.count} ${p.name} jobs`}>
              {pct > 10 && <span className="px-2 truncate">{p.count}</span>}
            </div>
          );
        })}
      </div>

      {/* Summary + breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-primary/5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{directJobs.length}</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">Direct Jobs</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-blue-50/50">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{partnerJobs.length}</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">Partner Jobs</div>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Partner Distribution</p>
          {groupedPartners.length > 0 ? (
            <div className="space-y-1">
              {groupedPartners.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-medium text-slate-600 truncate flex-1">{p.name}</span>
                  <span className="text-xs font-bold text-slate-700 tabular-nums">{p.count}</span>
                </div>
              ))}
              {groupedPartners.length > 3 && <p className="text-[10px] text-slate-400">+ {groupedPartners.length - 3} more</p>}
            </div>
          ) : (
            <p className="text-xs text-slate-400">All direct work</p>
          )}
        </div>
      </div>
    </div>
  );
}