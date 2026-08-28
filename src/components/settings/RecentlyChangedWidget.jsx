import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { History, Plus, Pencil, Trash2, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ACTION_ICON = {
  create: { Icon: Plus, cls: 'text-emerald-600 bg-emerald-50' },
  update: { Icon: Pencil, cls: 'text-blue-600 bg-blue-50' },
  delete: { Icon: Trash2, cls: 'text-rose-600 bg-rose-50' },
};

/**
 * Recently Changed — bento widget for the Settings Command Hub.
 *
 * Surfaces the last ~10 configuration mutations from the SystemAuditLog
 * (entity, action, record summary, actor, relative time) so admins can
 * see who changed what, when.
 */
export default function RecentlyChangedWidget() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['settings-recent-changes'],
    queryFn: () => base44.entities.SystemAuditLog.list('-created_date', 10),
  });

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <History className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">Recently Changed</h3>
          <p className="text-[11px] text-slate-500 font-medium">Latest configuration activity</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-2/3 rounded bg-slate-100 animate-pulse" />
                <div className="h-2 w-1/3 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-6 text-center">
          <Bot className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-500">No recent changes</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Configuration activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {logs.map(log => {
            const a = ACTION_ICON[log.action] || { Icon: Pencil, cls: 'text-slate-600 bg-slate-50' };
            const ActionIcon = a.Icon;
            const summary = log.record_summary || `${log.action} ${log.entity_name}`;
            return (
              <div key={log.id} className="flex items-center gap-2.5 px-1.5 py-2 rounded-xl hover:bg-slate-50 transition">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.cls}`}>
                  <ActionIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{summary}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {log.actor_name || 'system'} · {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}