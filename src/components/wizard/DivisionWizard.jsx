import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, Check, Loader2, Rocket, Building2, Layers, Plug } from 'lucide-react';
import { defaultsForType, toProperCase } from './divisionWizardData';
import DivisionPreviewCard from './DivisionPreviewCard';
import { StepIdentity, StepHubs, StepIntegrations, StepReview } from './WizardSteps';

const STEPS = [
  { id: 'identity', label: 'Identity', icon: Building2 },
  { id: 'hubs', label: 'Hubs', icon: Layers },
  { id: 'integrations', label: 'Connect', icon: Plug },
  { id: 'review', label: 'Launch', icon: Rocket },
];

const _generalDefaults = defaultsForType('general');
const EMPTY_FORM = {
  name: '', code: '', division_type: 'general', description: '',
  logo_url: '', is_active: true, status: 'setup', sort_order: 0,
  landing_page: '',
  // Brand defaults from the type blueprint, but hubs start empty — the admin
  // chooses which hubs to enable from a blank slate (no pre-selection).
  color: _generalDefaults.color,
  tagline: _generalDefaults.tagline,
  nav_items: _generalDefaults.nav_items,
  settings: _generalDefaults.settings,
  enabled_hubs: [],
  enabled_tabs: {},
};

export default function DivisionWizard({ onClose, onCreated }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setFormRaw] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Fetch existing divisions to offer as copy templates.
  const { data: divisions = [], isLoading: divisionsLoading } = useQuery({
    queryKey: ['wizard-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  // Custom setter: when the division type changes, atomically apply the full
  // blueprint (color, tagline, hubs, nav, settings) so every new division
  // starts with the exact same base configuration as Geotechnical.
  const setForm = (updater) => {
    setFormRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next.division_type !== prev.division_type) {
        // Apply the type's brand defaults (colour, tagline, nav, settings) but
        // do NOT pre-fill hubs — the admin chooses hubs from a blank slate.
        const d = defaultsForType(next.division_type);
        return { ...next, color: d.color, tagline: d.tagline, nav_items: d.nav_items, settings: d.settings };
      }
      return next;
    });
  };

  // Apply a template division — copies hubs, nav, settings, type, colour and
  // tagline from an existing division. Pass null to start from scratch.
  const applyTemplate = (template) => {
    if (!template) {
      setFormRaw(prev => ({
        ...prev,
        ...defaultsForType('general'),
        division_type: 'general',
      }));
      setSelectedTemplateId(null);
      return;
    }
    setFormRaw(prev => ({
      ...prev,
      division_type: template.division_type || 'general',
      color: template.color || '#2E5A1A',
      tagline: template.tagline || '',
      description: template.description || '',
      logo_url: template.logo_url || '',
      enabled_hubs: [...(template.enabled_hubs || [])],
      enabled_tabs: { ...(template.enabled_tabs || {}) },
      nav_items: [...(template.nav_items || [])],
      settings: { ...(template.settings || {}) },
      landing_page: template.landing_page || '',
    }));
    setSelectedTemplateId(template.id);
  };

  const canProceed = step === 0
    ? form.name.trim() && form.code.trim()
    : step === 1
      ? (form.enabled_hubs || []).length > 0
      : true;

  const next = () => { if (step < STEPS.length - 1) { setDirection(1); setStep(step + 1); } };
  const back = () => { if (step > 0) { setDirection(-1); setStep(step - 1); } };

  const launch = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Name and code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: toProperCase(form.name.trim()),
        code: form.code.toUpperCase().trim(),
      };
      await base44.entities.Division.create(payload);
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      queryClient.invalidateQueries({ queryKey: ['ent-staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-division-mgr'] });
      setLaunched(true);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#2E5A1A', '#8DC63F', '#10b981'] });
      setTimeout(() => { onCreated(); }, 1600);
    } catch (e) {
      toast({ title: 'Creation failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const StepComponent = [StepIdentity, StepHubs, StepIntegrations, StepReview][step];

  return (
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[97dvh] overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl command-gradient flex items-center justify-center shadow-md">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Create a Business Stream</h3>
              <p className="text-[11px] text-slate-400">Step {step + 1} of {STEPS.length} {'\u00B7'} {STEPS[step].label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Progress tracker */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.id}>
                <div className={'flex items-center gap-1.5 transition ' + (active ? 'scale-110' : '')}>
                  <div className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ' + (done ? 'bg-primary text-white' : active ? 'command-gradient text-white shadow-md' : 'bg-slate-100 text-slate-400')}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={'text-[11px] font-bold hidden sm:inline ' + (active ? 'text-slate-900' : done ? 'text-primary' : 'text-slate-400')}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={'flex-1 h-0.5 rounded-full transition ' + (done ? 'bg-primary' : 'bg-slate-200')} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body: step content + preview */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[1fr_320px] gap-0">
            <div className="p-5">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <StepComponent form={form} setForm={setForm} divisions={divisions} divisionsLoading={divisionsLoading} applyTemplate={applyTemplate} selectedTemplateId={selectedTemplateId} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hidden lg:block p-5 bg-slate-50/50 border-l border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Live Preview</p>
              <DivisionPreviewCard form={form} />
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-shrink-0 bg-white">
          <button onClick={back} disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={next} disabled={!canProceed}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={launch} disabled={saving || launched}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-60 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : launched ? <Check className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
              {saving ? 'Launching…' : launched ? 'Launched!' : 'Launch Workspace'}
            </button>
          )}
        </div>

        {/* Launch celebration overlay */}
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
              <h3 className="text-xl font-extrabold text-slate-900">Workspace Launched!</h3>
              <p className="text-sm text-slate-500 mt-1">{toProperCase(form.name)} is ready to go.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}