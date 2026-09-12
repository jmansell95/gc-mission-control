import React, { useState } from 'react';
import {
  Download, Loader2, FileText, ChevronRight, ChevronDown,
  Building2, Users, Truck, Package, ShieldCheck, PoundSterling,
  Map, ClipboardList, Settings, Cloud, Grid3x3, Printer,
  RefreshCw, Zap, Sparkles, Target,
} from 'lucide-react';
import { buildTeamBriefingPDF } from '@/lib/teamBriefingPdf';
import {
  whyBuilt, hubTour, deepDive, closingPoints,
} from '@/lib/teamBriefingContent';
import { EMBLEM_URL } from '@/components/Logo';
import PageHeader from '@/components/PageHeader';

const ICONS = {
  Building2, Users, Truck, Package, ShieldCheck, PoundSterling,
  Map, ClipboardList, Settings, Cloud, Grid3x3, Printer,
  RefreshCw, Zap, Sparkles, Target,
};

function HubCard({ item, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = ICONS[item.icon] || FileText;
  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50/50 transition"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate">{item.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.summary}</p>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-5 pt-1 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-4 mb-2">Key talking points</p>
          <ul className="space-y-2">
            {item.talkingPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8DC63F] mt-2 flex-shrink-0" />
                <span className="text-sm text-slate-700 leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PresentationPack() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await buildTeamBriefingPDF(EMBLEM_URL);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Sorry, the PDF could not be generated. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Team Briefing Pack"
        subtitle="Full platform walkthrough · Print-ready PDF"
        actions={
          <button
            onClick={handleDownload}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white text-sm font-semibold hover:from-[#1c4a12] hover:to-[#4d7c2a] transition shadow-md disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{generating ? 'Building…' : 'Download PDF'}</span>
          </button>
        }
      />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Hero */}
        <div className="hub-glass rounded-2xl overflow-hidden">
          <div className="hero-gradient px-5 sm:px-7 py-6 text-white">
            <img src={EMBLEM_URL} alt="Ground Control" className="h-10 mb-3 object-contain brightness-0 invert" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">Team Briefing Pack</h2>
            <p className="text-sm text-white/85 leading-relaxed max-w-xl">
              A full walkthrough of the GC Mission Control platform — why we built it, a tour of every hub,
              and a deep-dive on recent major work. Read it on screen or download the PDF to present from.
            </p>
          </div>
        </div>

        {/* Part 1: Why We Built This */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Part 1 — Why We Built This</h2>
          </div>

          <div className="hub-glass rounded-2xl p-5 sm:p-6">
            <p className="text-sm text-slate-700 leading-relaxed">{whyBuilt.intro}</p>
          </div>

          <div className="hub-glass rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">What was going wrong</h3>
            <ul className="space-y-2">
              {whyBuilt.problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 flex-shrink-0" />
                  <span className="text-sm text-slate-700 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="hub-glass rounded-2xl p-5 sm:p-6 bg-emerald-50/40 border-emerald-200/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="text-sm font-bold text-primary">The solution</h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{whyBuilt.solution}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {whyBuilt.outcomes.map((o, i) => (
              <div key={i} className="hub-glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{o.label}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{o.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Part 2: Platform Tour */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 pt-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Part 2 — Platform Tour</h2>
          </div>
          <p className="text-sm text-slate-500 px-1 leading-relaxed">
            The platform is organised into nine hubs — each one a dedicated workspace for a specific operational domain.
            Tap any card to expand the talking points.
          </p>
          <div className="space-y-3">
            {hubTour.map((hub, i) => (
              <HubCard key={i} item={hub} defaultOpen={i === 0} />
            ))}
          </div>
        </div>

        {/* Part 3: Deep-Dive */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 pt-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Cloud className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Part 3 — Deep-Dive: Recent Major Work</h2>
          </div>
          <p className="text-sm text-slate-500 px-1 leading-relaxed">
            The major additions and improvements we have made recently — what they are and why they matter.
          </p>
          <div className="space-y-3">
            {deepDive.map((topic, i) => (
              <HubCard key={i} item={topic} defaultOpen={false} />
            ))}
          </div>
        </div>

        {/* Part 4: What This Means For You */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 pt-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Part 4 — What This Means For You</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {closingPoints.roles.map((roleBlock, i) => (
              <div key={i} className="hub-glass rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-[#8DC63F]" />
                  <h3 className="text-sm font-bold text-slate-900">{roleBlock.role}</h3>
                </div>
                <ul className="space-y-2">
                  {roleBlock.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8DC63F] mt-2 flex-shrink-0" />
                      <span className="text-xs text-slate-600 leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Download CTA */}
        <div className="hub-glass rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold mb-1">Download the full briefing pack</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                A polished, multi-page PDF with a cover page, every section and clean typography — ready to print or present from.
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-primary rounded-xl font-semibold text-sm hover:bg-white/90 transition shadow-lg disabled:opacity-60 whitespace-nowrap flex-shrink-0"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generating ? 'Building PDF…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}