import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Sparkles, Waves, Palette, Image as ImageIcon, Square, Mountain, Play,
  Clock,
} from 'lucide-react';
import DivisionLoadingScreen from '@/components/divisionLoading/DivisionLoadingScreen';

const ANIMATION_PRESETS = [
  { id: 'themed_scene', label: 'Themed Scene', desc: 'Auto from stream type', icon: Mountain },
  { id: 'particle_field', label: 'Particles', desc: 'Floating brand particles', icon: Sparkles },
  { id: 'flowing_lines', label: 'Flowing Lines', desc: 'Animated line streams', icon: Waves },
  { id: 'gradient_mesh', label: 'Gradient Mesh', desc: 'Animated colour mesh', icon: Palette },
  { id: 'custom_media', label: 'Custom Media', desc: 'Your own image or video', icon: ImageIcon },
  { id: 'none', label: 'None', desc: 'Static gradient only', icon: Square },
];

const TRANSITION_STYLES = [
  { id: 'fade', label: 'Fade' },
  { id: 'slide_up', label: 'Slide Up' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'slide_right', label: 'Slide Right' },
];

const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wide';
const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm';

/**
 * LoadingAnimationConfigEditor — shared UI for configuring a division's
 * login_animation_config. Used by the Division Wizard (StepLoading) and
 * the Division Editor (Loading tab).
 *
 * Props:
 *   config — the login_animation_config object (may be {} for new divisions)
 *   onChange(newConfig) — callback with the updated config
 *   divisionType — for themed_scene preview selection
 *   divisionColor — fallback primary color
 *   divisionName — fallback welcome text
 *   divisionTagline — fallback tagline
 */
export default function LoadingAnimationConfigEditor({
  config = {},
  onChange,
  divisionType = 'general',
  divisionColor = '#2E5A1A',
  divisionName = 'Business Stream',
  divisionTagline = '',
}) {
  const [previewing, setPreviewing] = useState(false);

  const cfg = config || {};
  const update = (patch) => onChange({ ...cfg, ...patch });

  const animationType = cfg.animation_type || 'themed_scene';
  const primaryColor = cfg.primary_color || divisionColor;
  const secondaryColor = cfg.secondary_color || '#1c4a12';
  const accentColor = cfg.accent_color || '#8DC63F';
  const welcomeText = cfg.welcome_text || `${divisionName} is loading`;
  const tagline = cfg.tagline || divisionTagline || '';
  const logoUrl = cfg.logo_url || '';
  const durationMs = cfg.duration_ms || 3600;
  const transitionStyle = cfg.transition_style || 'fade';
  const showProgressBar = cfg.show_progress_bar !== false;
  const customMediaUrl = cfg.custom_media_url || '';
  const customMediaType = cfg.custom_media_type || 'image';

  // Preview division object (mock for the preview overlay)
  const previewDivision = {
    name: divisionName,
    color: divisionColor,
    tagline: divisionTagline,
    division_type: divisionType,
    login_animation_config: cfg,
  };

  return (
    <div className="space-y-5">
      {/* Animation Type Presets */}
      <div>
        <label className={labelCls}>Animation Type</label>
        <p className="text-[11px] text-slate-400 mt-0.5">Choose a preset or add your own custom media.</p>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ANIMATION_PRESETS.map(preset => {
            const Icon = preset.icon;
            const active = animationType === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => update({ animation_type: preset.id })}
                className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition ${
                  active ? 'border-primary bg-emerald-50 ring-1 ring-primary/20' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${active ? 'text-primary' : 'text-slate-700'}`}>{preset.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{preset.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Media URL (only when custom_media is selected) */}
      {animationType === 'custom_media' && (
        <div className="hub-glass rounded-xl p-3 space-y-2">
          <label className={labelCls}>Custom Media URL</label>
          <input
            value={customMediaUrl}
            onChange={e => update({ custom_media_url: e.target.value })}
            placeholder="https://... (image or video URL)"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update({ custom_media_type: 'image' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                customMediaType === 'image' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Image
            </button>
            <button
              type="button"
              onClick={() => update({ custom_media_type: 'video' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                customMediaType === 'video' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Video (loops muted)
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Paste a URL to your own image or video. Videos play muted on loop as the loading background.
            Use a landscape image/video for best results.
          </p>
        </div>
      )}

      {/* Colours */}
      <div>
        <label className={labelCls + ' flex items-center gap-1.5'}><Palette className="w-3.5 h-3.5" /> Brand Colours</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <ColorField label="Primary" value={primaryColor} onChange={v => update({ primary_color: v })} />
          <ColorField label="Secondary" value={secondaryColor} onChange={v => update({ secondary_color: v })} />
          <ColorField label="Accent" value={accentColor} onChange={v => update({ accent_color: v })} />
        </div>
      </div>

      {/* Text */}
      <div className="space-y-2">
        <div>
          <label className={labelCls}>Welcome Text</label>
          <input
            value={welcomeText}
            onChange={e => update({ welcome_text: e.target.value })}
            placeholder={`${divisionName} is loading`}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input
            value={tagline}
            onChange={e => update({ tagline: e.target.value })}
            placeholder={divisionTagline || 'Optional subtitle shown during loading'}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Logo URL (optional)</label>
          <input
            value={logoUrl}
            onChange={e => update({ logo_url: e.target.value })}
            placeholder="https://... (shown above the welcome text)"
            className={inputCls}
          />
        </div>
      </div>

      {/* Timing & Transition */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls + ' flex items-center gap-1.5'}><Clock className="w-3.5 h-3.5" /> Duration</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min="1000"
              max="6000"
              step="200"
              value={durationMs}
              onChange={e => update({ duration_ms: Number(e.target.value) })}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-bold text-slate-600 tabular-nums w-12 text-right">{(durationMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>Transition Out</label>
          <select
            value={transitionStyle}
            onChange={e => update({ transition_style: e.target.value })}
            className={inputCls}
          >
            {TRANSITION_STYLES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Progress bar toggle */}
      <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
        <div>
          <p className="text-xs font-bold text-slate-700">Show Progress Bar</p>
          <p className="text-[10px] text-slate-400">Displays a loading bar at the bottom</p>
        </div>
        <button
          type="button"
          onClick={() => update({ show_progress_bar: !showProgressBar })}
          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${showProgressBar ? 'bg-primary' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${showProgressBar ? 'translate-x-5' : ''}`} />
        </button>
      </label>

      {/* Preview button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl command-gradient text-white text-sm font-bold shadow-md hover:shadow-lg transition"
        >
          <Play className="w-4 h-4" /> Preview Animation
        </button>
        <p className="text-[10px] text-slate-400 mt-1.5">Plays the full-screen loading animation with your current settings.</p>
      </div>

      {/* Preview overlay */}
      <AnimatePresence>
        {previewing && (
          <DivisionLoadingScreen
            division={previewDivision}
            duration={durationMs}
            onComplete={() => setPreviewing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer flex-shrink-0"
        />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
        />
      </div>
    </div>
  );
}