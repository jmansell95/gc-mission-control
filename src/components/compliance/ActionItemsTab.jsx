import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Clock, User, Calendar, CheckCircle2, Circle,
  Loader2, Filter, Search, ChevronRight,
} from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import { PRIORITY_TONE, fmtDate, fmtRelative } from './auditConstants';

const ACTION_STATUS_META = {
  open: { label: 'Open', icon: Circle, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress', icon: Clock, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  closed: { label: 'Closed', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

/**
 * ActionItemsTab — aggregates all open action items across every
 * SafetyReport, with overdue alerts and assignee filtering.
 */
export default function ActionItemsTab() {
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-action-items'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
  });

  // Flatten all action items across all reports
  const allActionItems = useMemo(() => {
    const items = [];
    for (const r of reports) {
      if (!r.auditor_staff_id) continue;
      const actions = r.action_items || [];
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a || typeof a !== 'object') continue;
        items.push({
          ...a,
          _reportId: r.id,
          _auditId: r.safetyculture_audit_id,
          _auditTitle: r.audit_title || r.audit_template_name || 'Untitled audit',
          _auditCategory: r.audit_category,
          _jobName: r.job_name,
          _siteName: r.site_name,
          _conductedAt: r.conducted_at,
          _index: i,
          _status: a.status || 'open',
        });
      }
    }
    return items;
  }, [reports]);

  // Build assignee list
  const assignees = useMemo(() => {
    const set = new Map();
    for (const a of allActionItems) {
      if (a.assignee) set.set(a.assignee, true);
    }
    return Array.from(set.keys()).sort();
  }, [allActionItems]);

  const filtered = useMemo(() => {
    let list = allActionItems;
    if (statusFilter !== 'all') list = list.filter(a => a._status === statusFilter);
    else list = list.filter(a => a._status !== 'closed'); // Default: show non-closed
    if (assigneeFilter !== 'all') list = list.filter(a => a.assignee === assigneeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a =>
        (a.description || '').toLowerCase().includes(q) ||
        (a._auditTitle || '').toLowerCase().includes(q) ||
        (a._jobName || '').toLowerCase().includes(q)
      );
    }
    // Sort: overdue first, then by due date
    return list.sort((a, b) => {
      const aOver = isOverdue(a.due_date) ? 0 : 1;
      const bOver = isOverdue(b.due_date) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return 0;
    });
  }, [allActionItems, statusFilter, assigneeFilter, query]);

  const stats = useMemo(() => ({
    total: allActionItems.length,
    open: allActionItems.filter(a => a._status === 'open').length,
    inProgress: allActionItems.filter(a => a._status === 'in_progress').length,
    closed: allActionItems.filter(a => a._status === 'closed').length,
    overdue: allActionItems.filter(a => a._status !== 'closed' && isOverdue(a.due_date)).length,
  }), [allActionItems]);

  const handleStatusChange = async (item, newStatus) => {
    setUpdating(item._reportId + '-' + item._index);
    try {
      // Fetch the full action_items array, update the one item, save back
      const report = reports.find(r => r.id === item._reportId);
      if (!report) return;
      const updated = (report.action_items || []).map((a, i) =>
        i === item._index ? { ...a, status: newStatus } : a
      );
      await base44.functions.invoke('updateAuditActionItems', {
        audit_id: item._auditId,
        action_items: updated,
      });
      queryClient.invalidateQueries({ queryKey: ['safety-reports-action-items'] });
    } catch (e) { /* best-effort */ }
    setUpdating(null);
  };

  if (isLoading) return <HubLoadingState variant="list" count={4} />;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Open', value: stats.open, gradient: 'stat-gradient-amber', icon: AlertTriangle },
          { label: 'In Progress', value: stats.inProgress, gradient: 'stat-gradient-blue', icon: Clock },
          { label: 'Overdue', value: stats.overdue, gradient: 'stat-gradient-rose', icon: AlertTriangle },
          { label: 'Closed', value: stats.closed, gradient: 'stat-gradient-emerald', icon: CheckCircle2 },
        ].map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="hub-glass rounded-2xl p-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-lg ${tile.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">{tile.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{tile.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search action items…" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A]">
          <option value="open">Open + In Progress</option>
          <option value="all">All statuses</option>
          <option value="open">Open only</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A] max-w-[160px]">
          <option value="all">All assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <HubEmptyState icon={CheckCircle2} title="No action items" description="Open action items from Mitti audits will appear here with assignee, due date, and status tracking." />
      ) : (
        <HubCard icon={AlertTriangle} title="Action Items" subtitle={`${filtered.length} item${filtered.length !== 1 ? 's' : ''}`} tone="amber" padded={false}>
          <div className="divide-y divide-slate-100">
            {filtered.map((item, i) => {
              const overdue = isOverdue(item.due_date) && item._status !== 'closed';
              const statusMeta = ACTION_STATUS_META[item._status] || ACTION_STATUS_META.open;
              const StatusIcon = statusMeta.icon;
              const isUpdating = updating === item._reportId + '-' + item._index;
              return (
                <div key={i} className={`px-4 sm:px-5 py-3 hover:bg-slate-50/50 transition ${overdue ? 'bg-rose-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-rose-100' : 'bg-amber-100'}`}>
                      <AlertTriangle className={`w-4 h-4 ${overdue ? 'text-rose-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold text-slate-800 flex-1">{item.description || 'Untitled action'}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_TONE[item.priority] || PRIORITY_TONE.medium}`}>{(item.priority || 'medium').toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                        <span className="truncate font-medium text-slate-600">{item._auditTitle}</span>
                        {item._jobName && <span>· {item._jobName}</span>}
                        {item.assignee && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{item.assignee}</span>}
                        {item.due_date && (
                          <span className={`flex items-center gap-0.5 ${overdue ? 'text-rose-600 font-bold' : ''}`}>
                            <Calendar className="w-3 h-3" />{fmtDate(item.due_date)}
                            {overdue && <span className="ml-0.5">· OVERDUE</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Status changer */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        ['open', 'in_progress', 'closed'].map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(item, s)}
                            className={`text-[9px] font-bold px-1.5 py-1 rounded-md transition ${item._status === s ? ACTION_STATUS_META[s].tone + ' border' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            title={ACTION_STATUS_META[s].label}
                          >
                            {ACTION_STATUS_META[s].label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </HubCard>
      )}
    </div>
  );
}