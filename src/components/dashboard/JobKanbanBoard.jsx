import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, Calendar, Users, GripVertical, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/StateViews';

const COLUMNS = [
  { id: 'planning', label: 'Planning', color: 'bg-slate-100', dot: 'bg-slate-400', header: 'bg-slate-50' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50', dot: 'bg-blue-500', header: 'bg-blue-50' },
  { id: 'decommissioning', label: 'Decommissioning', color: 'bg-amber-50', dot: 'bg-amber-500', header: 'bg-amber-50' },
  { id: 'completed', label: 'Completed', color: 'bg-emerald-50', dot: 'bg-emerald-500', header: 'bg-emerald-50' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-rose-50', dot: 'bg-rose-400', header: 'bg-rose-50' },
];

/**
 * Kanban board view for jobs — drag cards between status columns to update
 * job status. Each card shows name, location, dates, and today's crew count.
 * Click a card to open the job detail.
 */
export default function JobKanbanBoard({ onSelectJob }) {
  const { toast } = useToast();
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-kanban'],
    queryFn: () => base44.entities.Job.list('-updated_date', 500),
  });

  const { data: todayRotas = [] } = useQuery({
    queryKey: ['rotas-today-kanban'],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: format(new Date(), 'yyyy-MM-dd') }),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-kanban'],
    queryFn: () => base44.entities.Client.list(),
  });
  const partnerClientMap = useMemo(() => {
    const m = {};
    clients.forEach(c => { if (c.is_partner) m[c.id] = c; });
    return m;
  }, [clients]);

  const parentClientMap = useMemo(() => {
    const m = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  const crewTodayByJob = useMemo(() => {
    const m = {};
    todayRotas.forEach(r => {
      if (r.job_id) m[r.job_id] = (m[r.job_id] || 0) + 1;
    });
    return m;
  }, [todayRotas]);

  const jobsByStatus = useMemo(() => {
    const m = {};
    COLUMNS.forEach(c => { m[c.id] = []; });
    jobs.forEach(j => {
      const status = j.status || 'planning';
      if (m[status]) m[status].push(j);
    });
    return m;
  }, [jobs]);

  const handleDrop = async (status) => {
    setDragOver(null);
    if (!dragId) return;
    const job = jobs.find(j => j.id === dragId);
    if (!job || job.status === status) { setDragId(null); return; }

    try {
      await base44.entities.Job.update(dragId, {
        status,
        status_changed_at: new Date().toISOString(),
      });
      toast({ title: `Moved to ${COLUMNS.find(c => c.id === status)?.label}`, description: job.name });
    } catch (err) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
    setDragId(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map(c => <Skeleton key={c.id} className="h-64 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {COLUMNS.map(col => (
        <div
          key={col.id}
          className={`rounded-xl border ${dragOver === col.id ? 'border-primary border-2' : 'border-slate-200'} ${col.color} flex flex-col min-h-64 transition`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleDrop(col.id)}
        >
          <div className={`px-3 py-2.5 rounded-t-xl ${col.header} flex items-center justify-between`}>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className="text-xs font-bold text-slate-700">{col.label}</span>
            </div>
            <span className="text-xs font-bold text-slate-400 tabular-nums">{jobsByStatus[col.id].length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[60vh]">
            {jobsByStatus[col.id].map(job => (
              <div
                key={job.id}
                draggable
                onDragStart={() => setDragId(job.id)}
                onDragEnd={() => { setDragId(null); setDragOver(null); }}
                onClick={() => onSelectJob?.(job)}
                className={`bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:shadow-md hover:border-slate-300 transition ${dragId === job.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-1.5">
                  <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">{job.name}</p>
                    {partnerClientMap[job.client_id] && (() => {
                      const partner = partnerClientMap[job.client_id];
                      const parent = partner.parent_client_id ? parentClientMap[partner.parent_client_id] : null;
                      return (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {parent && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: (parent.partner_color || partner.partner_color || '#2563eb') + '15',
                                color: parent.partner_color || partner.partner_color || '#2563eb',
                              }}
                            >
                              <Building2 className="w-2 h-2" /> {parent.name}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide"
                            style={{
                              backgroundColor: (partner.partner_color || '#2563eb') + '15',
                              color: partner.partner_color || '#2563eb',
                            }}
                          >
                            {parent && <span className="opacity-40">↳</span>} <Building2 className="w-2 h-2" /> {partner.name}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {job.location && (
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    {job.location}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                  {job.start_date && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(job.start_date), 'dd MMM')}
                    </span>
                  )}
                  {crewTodayByJob[job.id] > 0 && (
                    <span className="flex items-center gap-0.5 text-primary font-medium">
                      <Users className="w-2.5 h-2.5" />
                      {crewTodayByJob[job.id]}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {jobsByStatus[col.id].length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-4">No jobs</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}