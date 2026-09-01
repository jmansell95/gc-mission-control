import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const severityConfig = {
  critical: { icon: AlertCircle, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  warning: { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
};

/**
 * RotaSuggestionsPopup — button + popup showing rota warnings/suggestions.
 * Replaces the inline collapsible RotaWarningsPanel.
 * Button shows a count badge (red for critical, amber for warnings).
 * Hidden when there are no warnings.
 */
export default function RotaSuggestionsPopup({ warnings = [] }) {
  const [open, setOpen] = useState(false);

  if (warnings.length === 0) return null;

  const critical = warnings.filter(w => w.severity === 'critical');
  const warns = warnings.filter(w => w.severity === 'warning');
  const hasCritical = critical.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition text-sm font-semibold shadow-sm ${
          hasCritical ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
        }`}
      >
        {hasCritical ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        <span className="hidden sm:inline">Rota Suggestions</span>
        <span className="sm:hidden">Suggestions</span>
        <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${hasCritical ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
          {warnings.length}
        </span>
      </button>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 pr-8">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${hasCritical ? 'bg-red-100' : 'bg-amber-100'}`}>
                {hasCritical ? <AlertCircle className="w-5 h-5 text-red-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              </div>
              <div className="min-w-0">
                <p>{hasCritical ? 'Rota issues need attention' : 'Rota suggestions'}</p>
                <p className="text-xs font-normal text-slate-500">
                  {critical.length > 0 && <span className="text-red-600 font-medium">{critical.length} critical</span>}
                  {critical.length > 0 && warns.length > 0 && <span className="text-slate-400"> · </span>}
                  {warns.length > 0 && <span className="text-amber-600 font-medium">{warns.length} warning{warns.length !== 1 ? 's' : ''}</span>}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {warnings.map((w, i) => {
              const cfg = severityConfig[w.severity];
              const Icon = cfg.icon;
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 border ${cfg.border} bg-slate-50/50`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${w.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{w.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{w.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}