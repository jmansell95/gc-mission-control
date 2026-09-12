import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { X, Layers, Loader2, Check, Sparkles } from 'lucide-react';
import { toProperCase } from '@/components/wizard/divisionWizardData';

const PRESET_COLORS = ['#2E5A1A', '#0ea5e9', '#6366f1', '#f59e0b', '#e11d48', '#0d9488', '#8b5cf6', '#475569'];

/**
 * BusinessUnitCreateModal — compact, single-step identity form for creating
 * a top-level business unit (a Division record with parent_division_id null).
 * Fields: name, code, tagline, accent colour, description.
 */
export default function BusinessUnitCreateModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', tagline: '', color: '#2E5A1A', description: '' });
  const [saving, setSaving] = useState(false);
  const [launched, setLaunched] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const canSubmit = form.name.trim() && form.code.trim();

  const submit = async () => {
    if (!canSubmit) {
      toast({ title: 'Name and code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Division.create({
        name: toProperCase(form.name.trim()),
        code: form.code.toUpperCase().trim(),
        tagline: form.tagline.trim(),
        color: form.color,
        description: form.description.trim(),
        parent_division_id: null,
        division_type: 'general',
        is_active: true,
        status: 'setup',
        sort_order: 0,
        enabled_hubs: [],
        enabled_tabs: {},
        nav_items: [],
        settings: {},
      });
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      queryClient.invalidateQueries({ queryKey: ['ent-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ent-staff'] });
      setLaunched(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#2E5A1A', '#8DC63F', '#10b981'] });
      setTimeout(() => { onCreated(); }, 1400);
    } catch (e) {
      toast({ title: 'Creation failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Create a Business Unit</h3>
              <p className="text-[11px] text-slate-400">Identity details — you can add divisions inside it next</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Land & Water Solutions"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none transition"
            />
          </Field>

          <Field label="Code" required hint="Short uppercase code (e.g. LWS)">
            <input
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="LWS"
              maxLength={6}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none transition uppercase"
            />
          </Field>

          <Field label="Tagline" hint="Shown on the BU card">
            <input
              value={form.tagline}
              onChange={e => set('tagline', e.target.value)}
              placeholder="Ground Investigation Specialists"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none transition"
            />
          </Field>

          <Field label="Accent Colour">
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={'w-8 h-8 rounded-full transition ' + (form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110')}
                  style={{ background: c }}
                />
              ))}
              <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-slate-400 transition overflow-hidden">
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              </label>
            </div>
          </Field>

          <Field label="Description" hint="What this business unit does">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Marine and waterway engineering services"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none transition resize-none"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-shrink-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving || launched}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : launched ? <Check className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            {saving ? 'Creating…' : launched ? 'Created!' : 'Create Business Unit'}
          </button>
        </div>

        {/* Launch celebration */}
        <AnimatePresence>
          {launched && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-20"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
                className="w-20 h-20 rounded-full command-gradient flex items-center justify-center shadow-2xl glow-brand mb-4">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </motion.div>
              <h3 className="text-xl font-extrabold text-slate-900">Business Unit Created!</h3>
              <p className="text-sm text-slate-500 mt-1">{toProperCase(form.name)} is ready.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span>
        {hint && <span className="text-[10px] text-slate-400 font-medium">{hint}</span>}
      </label>
      {children}
    </div>
  );
}