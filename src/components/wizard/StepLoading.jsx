import React from 'react';
import { Sparkles } from 'lucide-react';
import LoadingAnimationConfigEditor from '@/components/settings/LoadingAnimationConfigEditor';
import BlankSlateBanner from './BlankSlateBanner';

/**
 * StepLoading — Wizard step for configuring the division's loading
 * animation. Lets the admin pick from presets (themed scene, particles,
 * flowing lines, gradient mesh) or add their own custom media (image/video),
 * plus customise colours, text, timing and transition.
 *
 * The config is stored in form.login_animation_config and saved to the
 * Division entity's login_animation_config field on launch.
 */
export default function StepLoading({ form, setForm }) {
  const cfg = form.login_animation_config || {};

  return (
    <div className="space-y-4">
      <BlankSlateBanner stepLabel="Loading Screen" />

      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Loading Screen Animation</p>
            <p className="text-[11px] text-slate-400">Plays when users enter this business stream and after login.</p>
          </div>
        </div>
      </div>

      <LoadingAnimationConfigEditor
        config={cfg}
        onChange={(newCfg) => setForm({ ...form, login_animation_config: newCfg })}
        divisionType={form.division_type}
        divisionColor={form.color}
        divisionName={form.name || 'Business Stream'}
        divisionTagline={form.tagline}
      />
    </div>
  );
}