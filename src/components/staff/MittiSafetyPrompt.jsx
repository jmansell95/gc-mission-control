import React from 'react';
import { ExternalLink, ShieldCheck, Car, ClipboardCheck } from 'lucide-react';

/**
 * MittiSafetyPrompt — a reusable safety reminder card that links crew to a
 * specific Mitti/SafetyCulture inspection (vehicle check, POWRA, equipment
 * check) at the right moment in their daily flow.
 *
 * Props:
 *  - type: 'vehicle' | 'powra' | 'equipment' — controls icon, colour, copy.
 *  - url:  the SafetyCulture inspection link to open.
 *  - title: override the default title.
 *  - body:  override the default body copy.
 *  - timing: optional short label e.g. "Before you leave for site".
 *  - compact: render a slimmer one-line variant (for inline reminders).
 */
const PRESETS = {
  vehicle: {
    icon: Car,
    accent: 'indigo',
    title: 'Daily Vehicle Check',
    body: 'Complete your vehicle walk-round in Mitti before you leave for site. Check oil, tyres, lights, mirrors and damage.',
    timing: 'Before you leave for site',
  },
  powra: {
    icon: ShieldCheck,
    accent: 'amber',
    title: 'Point of Work Risk Assessment (POWRA)',
    body: 'Now you are on site, complete your POWRA in Mitti before starting any work. Assess site hazards, weather, and safe access.',
    timing: 'On arrival at site',
  },
  equipment: {
    icon: ClipboardCheck,
    accent: 'emerald',
    title: 'Equipment / Plant Check',
    body: 'Complete your equipment and plant check in Mitti before operating any machinery.',
    timing: 'Before starting work',
  },
};

const ACCENT_CLASSES = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600', titleText: 'text-indigo-900', bodyText: 'text-indigo-700', linkText: 'text-indigo-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', titleText: 'text-amber-900', bodyText: 'text-amber-700', linkText: 'text-amber-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', titleText: 'text-emerald-900', bodyText: 'text-emerald-700', linkText: 'text-emerald-700' },
};

export default function MittiSafetyPrompt({ type = 'vehicle', url, title, body, timing, compact = false }) {
  const preset = PRESETS[type] || PRESETS.vehicle;
  const Icon = preset.icon;
  const c = ACCENT_CLASSES[preset.accent];
  const finalTitle = title || preset.title;
  const finalBody = body || preset.body;
  const finalTiming = timing || preset.timing;

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2.5 ${c.bg} ${c.border} border rounded-xl px-3.5 py-2.5 active:scale-[0.98] transition`}
      >
        <Icon className={`w-4 h-4 ${c.iconText} flex-shrink-0`} />
        <span className={`text-xs font-semibold ${c.titleText} flex-1`}>{finalTitle}</span>
        <span className={`text-[10px] font-bold ${c.linkText} flex items-center gap-0.5`}>
          Open Mitti <ExternalLink className="w-3 h-3" />
        </span>
      </a>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${c.bg} ${c.border} border rounded-2xl px-4 py-4`}>
      <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${c.iconText}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-bold ${c.titleText}`}>{finalTitle}</p>
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${c.iconBg} ${c.iconText}`}>
            {finalTiming}
          </span>
        </div>
        <p className={`text-xs ${c.bodyText} mt-1 leading-relaxed`}>{finalBody}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-bold ${c.linkText} mt-2.5 px-3 py-2 rounded-lg ${c.iconBg} hover:opacity-80 transition active:scale-95`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Mitti & do it now
        </a>
      </div>
    </div>
  );
}