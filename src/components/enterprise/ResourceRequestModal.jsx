import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Cog, Calendar, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * ResourceRequestModal — "Ask about resourcing" modal.
 * Pre-fills the rig + date, lets the user describe the opportunity,
 * and creates an InboxItem routed to the division manager.
 */
export default function ResourceRequestModal({ rig, dateStr, divisionId, divMap, onClose }) {
  const { toast } = useToast();
  const [opportunityName, setOpportunityName] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const div = divMap?.[divisionId || rig?.division_id];
  const startDate = parseISO(dateStr);
  const endDate = addDays(startDate, durationDays - 1);

  const handleSubmit = async () => {
    if (!opportunityName.trim()) {
      toast({ title: 'Enter an opportunity name', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Create an InboxItem for the division manager
      await base44.entities.InboxItem.create({
        type: 'notice',
        category: 'resource_request',
        title: `Resource Request: ${rig.name} for "${opportunityName}"`,
        body: `Rig ${rig.name} (${rig.rig_type || 'unknown type'}) requested for ${format(startDate, 'dd MMM')} - ${format(endDate, 'dd MMM')} (${durationDays} days).\n\nOpportunity: ${opportunityName}\nNotes: ${notes || 'None'}`,
        source_hub: 'enterprise',
        source_entity: 'SiteAsset',
        source_id: rig.id,
        priority: 'normal',
        status: 'pending',
        assigned_to_name: div?.name ? `${div.name} Manager` : 'Division Manager',
        requester_name: 'Resource Planning',
      });

      setSubmitted(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      toast({ title: 'Failed to submit request', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-lg hub-glass rounded-2xl shadow-2xl overflow-hidden"
      >
        {submitted ? (
          <div className="p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            </motion.div>
            <p className="text-base font-bold text-slate-900">Request Submitted!</p>
            <p className="text-sm text-slate-500 mt-1">The division manager has been notified about this resource request.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative command-gradient px-5 py-4">
              <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Cog className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Resource This Slot</h3>
                  <p className="text-xs text-white/80">Request {rig.name} for a new opportunity</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Pre-filled info */}
              <div className="grid grid-cols-2 gap-2">
                <InfoTile icon={Cog} label="Rig" value={rig.name} />
                <InfoTile icon={MapPin} label="Division" value={div?.name || 'Unassigned'} />
                <InfoTile icon={Calendar} label="Start Date" value={format(startDate, 'dd MMM yyyy')} />
                <InfoTile icon={Calendar} label="End Date" value={format(endDate, 'dd MMM yyyy')} />
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Duration (days)</label>
                <div className="flex items-center gap-1.5">
                  {[1, 3, 5, 7, 14].map(d => (
                    <button
                      key={d}
                      onClick={() => setDurationDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${durationDays === d ? 'command-gradient text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {d}d
                    </button>
                  ))}
                  <input
                    type="number"
                    value={durationDays}
                    onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A] transition"
                  />
                </div>
              </div>

              {/* Opportunity name */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Opportunity / Job Name *</label>
                <input
                  value={opportunityName}
                  onChange={e => setOpportunityName(e.target.value)}
                  placeholder="e.g. Cambridge North Borehole Investigation"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any details about the opportunity — site location, client, rig type needed, etc."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex gap-2 bg-slate-50/50">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !opportunityName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">{label}</p>
        <p className="text-xs font-bold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}