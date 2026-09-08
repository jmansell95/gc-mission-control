import React, { useState } from 'react';
import { Sparkles, X, Check } from 'lucide-react';

/**
 * HubOnboardingBanner — first-run guidance shown once per hub per browser.
 * Dismissal is remembered in localStorage under `gc_onboarded_<hubKey>`.
 * Props: hubKey, title, description, steps: string[], cta: { label, onClick }
 */
export default function HubOnboardingBanner({ hubKey, title, description, steps = [], cta }) {
  const storageKey = `gc_onboarded_${hubKey}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');
  if (!hubKey || dismissed) return null;

  const dismiss = () => { localStorage.setItem(storageKey, '1'); setDismissed(true); };

  return (
    <div className="relative overflow-hidden rounded-3xl text-white animate-slide-up hero-vibrant shadow-md">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
        <X className="w-4 h-4" />
      </button>
      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-ui-micro uppercase tracking-[0.18em] text-white/70 mb-1">Getting started</div>
          <h3 className="text-ui-heading font-extrabold leading-tight">{title}</h3>
          {description && <p className="text-ui-body text-white/80 mt-1 leading-relaxed">{description}</p>}
          {steps.length > 0 && (
            <ol className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-ui-caption">
                  <span className="w-5 h-5 rounded-full bg-white text-[#2E5A1A] font-bold text-ui-micro flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="leading-snug">{s}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {cta && (
              <button type="button" onClick={cta.onClick} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white text-[#2E5A1A] text-ui-caption font-bold hover:bg-white/90 transition">{cta.label}</button>
            )}
            <button type="button" onClick={dismiss} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/15 text-ui-caption font-semibold hover:bg-white/25 transition">
              <Check className="w-4 h-4" /> Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}