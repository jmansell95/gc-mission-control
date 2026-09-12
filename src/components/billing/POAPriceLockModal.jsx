import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Lock, Loader2, X, Globe, FolderKanban, Briefcase, PoundSterling,
  FileText, Calendar, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SearchableSelect from '@/components/SearchableSelect';

const fmt = (n) => n != null && !isNaN(n) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-emerald-100';

const SCOPE_OPTIONS = [
  { value: 'job', label: 'Specific Job', icon: Briefcase, desc: 'Lock this price for one job only' },
  { value: 'project', label: 'Entire Project', icon: FolderKanban, desc: 'Lock for all jobs under this project' },
  { value: 'global', label: 'Global (All Jobs)', icon: Globe, desc: 'Update the rate card for everyone — no longer POA' },
];

/**
 * POA Price Lock Modal — lets the contracts team agree a price for a POA
 * rate card item and apply it to a job, project, or globally.
 *
 * When locked, the backend function retroactively stamps all unpriced cost
 * logs matching this POA item description.
 */
export default function POAPriceLockModal({
  item,
  projects,
  jobs,
  existingLocks,
  onClose,
  onLocked,
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState('job');
  const [projectId, setProjectId] = useState('');
  const [jobId, setJobId] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = () => {
    if (!agreedPrice || isNaN(parseFloat(agreedPrice))) return false;
    if (scope === 'project' && !projectId) return false;
    if (scope === 'job' && !jobId) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('lockPOAPrice', {
        rate_card_item_id: item.id,
        scope,
        project_id: scope === 'project' ? projectId : null,
        job_id: scope === 'job' ? jobId : null,
        agreed_price: parseFloat(agreedPrice),
        client_reference: clientReference || null,
        effective_date: effectiveDate || null,
        expiry_date: expiryDate || null,
        notes: notes || null,
      });
      const data = res?.data || res;
      if (data.stamped_records > 0) {
        toast({
          title: 'POA price locked',
          description: `${data.stamped_records} unpriced log${data.stamped_records === 1 ? '' : 's'} stamped with ${fmt(parseFloat(agreedPrice))} (${fmt(data.stamped_value_gbp)} total).`,
        });
      } else {
        toast({
          title: 'POA price locked',
          description: 'No unpriced logs found matching this item yet. Future logs will be priced automatically.',
        });
      }
      onLocked(data);
    } catch (err) {
      toast({
        title: 'Failed to lock POA price',
        description: err?.message || 'Could not save the lock',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  // Filter jobs by project if project scope is selected
  const availableJobs = scope === 'project' && projectId
    ? jobs.filter((j) => j.project_id === projectId)
    : jobs;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Lock POA Price
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item being priced */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Rate Card Item</p>
            <p className="text-sm font-medium text-slate-800">{item.description}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold border border-amber-200">
                {item.price_text || 'POA'}
              </span>
              {item.unit && <span className="text-[10px] text-slate-400">per {item.unit}</span>}
              {item.subcategory && <span className="text-[10px] text-slate-400">· {item.subcategory}</span>}
            </div>
          </div>

          {/* Existing locks warning */}
          {existingLocks.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold">{existingLocks.length} existing lock{existingLocks.length === 1 ? '' : 's'} on this item:</p>
                <ul className="mt-1 space-y-0.5">
                  {existingLocks.slice(0, 3).map((l) => (
                    <li key={l.id}>
                      • {fmt(l.agreed_price)} — {l.scope}
                      {l.scope === 'job' ? ` (job)` : l.scope === 'project' ? ` (project)` : ''}
                    </li>
                  ))}
                  {existingLocks.length > 3 && <li>...and {existingLocks.length - 3} more</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Scope selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Apply to *</label>
            <div className="grid grid-cols-3 gap-2">
              {SCOPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = scope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition ${
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {SCOPE_OPTIONS.find((o) => o.value === scope)?.desc}
            </p>
          </div>

          {/* Project selector */}
          {scope === 'project' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
              <SearchableSelect
                value={projectId}
                onChange={setProjectId}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Select a project..."
              />
            </div>
          )}

          {/* Job selector */}
          {scope === 'job' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <SearchableSelect
                value={jobId}
                onChange={setJobId}
                options={availableJobs.map((j) => ({
                  value: j.id,
                  label: `${j.name}${j.location ? ` — ${j.location}` : ''}`,
                }))}
                placeholder="Select a job..."
              />
            </div>
          )}

          {/* Agreed price */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Agreed Price (£) *
            </label>
            <div className="relative">
              <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                placeholder="0.00"
                className={inputCls + ' pl-9'}
                autoFocus
              />
            </div>
          </div>

          {/* Client reference */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Client Reference (PO / Quote #)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={clientReference}
                onChange={(e) => setClientReference(e.target.value)}
                placeholder="e.g. PO-12345"
                className={inputCls + ' pl-9'}
              />
            </div>
          </div>

          {/* Effective / Expiry dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Effective From
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Expires On
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Negotiation notes, conditions, special terms..."
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!canSave() || saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {saving ? 'Locking...' : 'Lock Price & Stamp Logs'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}