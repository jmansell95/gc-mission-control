import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, CheckCircle2, Circle, ExternalLink, Loader2, Hash, Lightbulb, FileText,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Pre-departure towing safety checklist — appears on driver hub delivery cards
 * when a trailer is assigned and the checklist hasn't been completed yet.
 * Gates the Start button: the delivery cannot be started until all 3 items
 * are confirmed (number plate, lights, toolbox talk opened).
 *
 * Props:
 *   delivery  — the DeliveryLog record (must have trailer_id)
 *   onDone    — callback fired after successful confirmation (e.g. start the delivery)
 */
export default function TowingChecklistCard({ delivery, onDone }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ticks, setTicks] = useState({ plate: false, lights: false, toolbox: false });
  const [confirming, setConfirming] = useState(false);

  // Fetch the towing toolbox talk URL from the global AppSetting
  const { data: toolboxUrl } = useQuery({
    queryKey: ['towing-toolbox-url'],
    queryFn: async () => {
      const settings = await base44.entities.AppSetting.filter({ key: 'global' });
      const val = settings?.[0]?.value;
      return (val && val.towing_toolbox_talk_url) || '';
    },
    staleTime: 5 * 60 * 1000,
  });

  const allTicked = ticks.plate && ticks.lights && ticks.toolbox;
  const alreadyDone = !!delivery?.towing_checklist_completed;

  const handleConfirm = async () => {
    if (!allTicked || confirming) return;
    setConfirming(true);
    try {
      await base44.entities.DeliveryLog.update(delivery.id, {
        towing_checklist_completed: true,
        towing_checklist_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      toast({ title: 'Towing checklist confirmed', description: 'Safe to depart — starting delivery.' });
      if (onDone) onDone(delivery.id);
    } catch (e) {
      toast({ title: 'Could not confirm checklist', description: e.message, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  // Already completed — show a compact confirmation badge
  if (alreadyDone) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-emerald-700">Towing checklist confirmed</p>
        {delivery.towing_checklist_at && (
          <span className="text-[10px] text-emerald-500 ml-auto">
            {new Date(delivery.towing_checklist_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
  }

  const items = [
    { key: 'plate', label: 'Grab trailer number plate', icon: Hash, sub: 'Record the plate for the log' },
    { key: 'lights', label: 'Check all lights & indicators', icon: Lightbulb, sub: 'Brake, indicators, plate light' },
    { key: 'toolbox', label: 'Open towing toolbox talk', icon: FileText, sub: 'Read the briefing before departure', isLink: true },
  ];

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">Towing Pre-Departure Checklist</p>
          <p className="text-[11px] text-amber-700">Trailer assigned — complete before departure</p>
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {items.map(item => {
          const done = ticks[item.key];
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.isLink && toolboxUrl) {
                  window.open(toolboxUrl, '_blank', 'noopener,noreferrer');
                }
                setTicks(prev => ({ ...prev, [item.key]: true }));
              }}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition touch-manipulation min-h-[44px] ${
                done ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-200 hover:border-amber-400'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${done ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${done ? 'text-emerald-800' : 'text-slate-700'}`}>{item.label}</p>
                <p className="text-[10px] text-slate-400">{item.sub}</p>
              </div>
              {item.isLink && (
                <ExternalLink className={`w-3.5 h-3.5 flex-shrink-0 ${done ? 'text-emerald-500' : 'text-amber-600'}`} />
              )}
            </button>
          );
        })}
      </div>

      {!toolboxUrl && (
        <p className="text-[10px] text-amber-600 px-1">Toolbox talk link not configured — ask your manager to set it in Settings.</p>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!allTicked || confirming}
        className="w-full inline-flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 active:scale-95 transition touch-manipulation min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirming ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Confirm & Start</>
        )}
      </button>
    </div>
  );
}