import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, Building2, Layers, ChevronRight, Network } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * Workload Ownership widget — splits active jobs into Direct vs Partner
 * (e.g. Concept Engineering, CGL). Partner jobs are grouped by their parent
 * holding group (e.g. Phenna Group) so managers can see the corporate
 * hierarchy at a glance: how much work flows through each group and which
 * operating entity within the group is carrying it.
 */
export default function WorkloadOwnershipWidget({ onNavigate }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  // Build client lookup maps
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
  const partnerPct = 100 - directPct;

  // Group partner clients by their parent_client_id — produces a hierarchy
  // of parent groups (e.g. Phenna Group) with their operating entities
  // (e.g. Concept, CGL) nested underneath.
  const groupedPartners = useMemo(() => {
    // Map: parent_id → { parent: Client, children: Client[] }
    const groups = {};
    const standalone = [];

    partnerClients.forEach(c => {
      if (c.parent_client_id && clientMap[c.parent_client_id]) {
        const parentId = c.parent_client_id;
        if (!groups[parentId]) {
          groups[parentId] = {
            parent: clientMap[parentId],
            children: [],
          };
        }
        groups[parentId].children.push(c);
      } else {
        // Partner with no parent — standalone partner (not part of a group)
        standalone.push(c);
      }
    });

    // Build breakdown entries — one per group + one per standalone partner
    const breakdown = [];

    // Groups first (sorted by total job count descending)
    Object.values(groups)
      .map(g => ({
        ...g,
        totalCount: g.children.reduce((sum, c) => sum + partnerJobs.filter(j => j.client_id === c.id).length, 0),
      }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .forEach(g => {
        breakdown.push({
          id: g.parent.id,
          name: g.parent.name,
          color: g.parent.partner_color || '#2563eb',
          count: g.totalCount,
          isGroup: true,
          children: g.children.map(c => ({
            id: c.id,
            name: c.name,
            color: c.partner_color || '#2563eb',
            count: partnerJobs.filter(j => j.client_id === c.id).length,
          })).filter(c => c.count > 0).sort((a, b) => b.count - a.count),
        });
      });

    // Standalone partners (no parent group)
    standalone.forEach(c => {
      const count = partnerJobs.filter(j => j.client_id === c.id).length;
      if (count > 0) {
        breakdown.push({
          id: c.id,
          name: c.name,
          color: c.partner_color || '#2563eb',
          count,
          isGroup: false,
        });
      }
    });

    return breakdown.filter(p => p.count > 0).sort((a, b) => b.count - a.count);
  }, [partnerClients, partnerJobs, clientMap]);

  return (
    <WidgetShell icon={Layers} title="Workload Ownership" subtitle="Direct vs partner-contracted jobs by group">
      {/* Split bar */}
      <div className="space-y-3">
        <div className="flex h-8 rounded-lg overflow-hidden shadow-sm">
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
              <div
                key={p.id}
                className="flex items-center justify-center text-white text-xs font-bold transition-all"
                style={{ width: `${pct}%`, backgroundColor: p.color }}
                title={`${p.count} ${p.name} jobs`}
              >
                {pct > 10 && <span className="px-2 truncate">{p.count}</span>}
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate?.('jobs')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{directJobs.length}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Direct Jobs</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary ml-auto transition" />
          </button>

          <button
            onClick={() => onNavigate?.('jobs')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{partnerJobs.length}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Partner Jobs</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 ml-auto transition" />
          </button>
        </div>

        {/* Partner breakdown — grouped by parent holding company */}
        {groupedPartners.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partner Distribution</p>
            {groupedPartners.map(p => (
              <div key={p.id} className="rounded-lg bg-slate-50/70 border border-slate-100/80 overflow-hidden">
                {/* Group / standalone partner header */}
                <div className="flex items-center gap-2.5 p-2">
                  {p.isGroup && (
                    <div className="w-6 h-6 rounded-md bg-slate-200/70 flex items-center justify-center flex-shrink-0">
                      <Network className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs font-bold text-slate-800 truncate flex-1">{p.name}</span>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">{p.count}</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">{Math.round((p.count / total) * 100)}%</span>
                </div>
                {/* Child entities within the group */}
                {p.isGroup && p.children.length > 0 && (
                  <div className="border-t border-slate-100/60">
                    {p.children.map(c => (
                      <div key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 pl-9 bg-white/40">
                        <span className="text-slate-300 text-xs">↳</span>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-xs font-medium text-slate-600 truncate flex-1">{c.name}</span>
                        <span className="text-xs font-bold text-slate-700 tabular-nums">{c.count}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">{Math.round((c.count / total) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {groupedPartners.length === 0 && partnerJobs.length === 0 && (
          <div className="flex items-center justify-center py-4 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-700">All Direct Work</p>
              <p className="text-xs text-slate-400 mt-0.5">No partner-contracted jobs currently active</p>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}