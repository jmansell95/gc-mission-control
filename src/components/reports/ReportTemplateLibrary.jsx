import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bookmark, Play, Clock, Trash2, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * My Reports library — grid of saved ReportTemplate cards. Each card shows
 * the template name, category, schedule status, and run/schedule/delete actions.
 */
export default function ReportTemplateLibrary({ onRun, onSchedule, onBuildCustom }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => base44.entities.ReportTemplate.list('-updated_date', 100),
  });

  const handleRun = async (tpl) => {
    setRunning(tpl.id);
    try {
      await base44.entities.ReportTemplate.update(tpl.id, { last_run_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      onRun?.(tpl);
      toast({ title: 'Template applied', description: `"${tpl.name}" filters loaded. View the report above.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not run template.', variant: 'destructive' });
    }
    setRunning(null);
  };

  const handleDelete = async (tpl) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    setDeleting(tpl.id);
    try {
      await base44.entities.ReportTemplate.delete(tpl.id);
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast({ title: 'Template deleted' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete template.', variant: 'destructive' });
    }
    setDeleting(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>;
  }

  if (templates.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-10 text-center">
        <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No saved reports yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
          Configure a report view and click "Save as Template", or build a custom report from scratch.
        </p>
        {onBuildCustom && (
          <button onClick={onBuildCustom} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition">
            Build Custom Report
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {templates.map(tpl => (
        <div key={tpl.id} className="insight-card rounded-2xl p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{tpl.name}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide mt-0.5">{tpl.category}</p>
            </div>
            {tpl.is_shared && <Share2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
          </div>

          {tpl.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{tpl.description}</p>}

          {tpl.schedule_cadence && tpl.schedule_cadence !== 'none' && (
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-fit mb-3">
              <Clock className="w-3 h-3" /> {tpl.schedule_cadence}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2">
            <button onClick={() => handleRun(tpl)} disabled={running === tpl.id}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E5A1A] text-white text-xs font-bold hover:bg-[#1c4a12] transition disabled:opacity-50">
              {running === tpl.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run
            </button>
            <button onClick={() => onSchedule?.(tpl)} title="Schedule"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(tpl)} disabled={deleting === tpl.id} title="Delete"
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition disabled:opacity-50">
              {deleting === tpl.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}