import React, { useState } from 'react';
import { Download, Loader2, ShieldCheck, TrendingUp, Map, FileText, Sparkles, Clock, HardHat, FileClock, Link2, Smartphone, Building2, GitBranch, Users, ScrollText, Grid3x3 } from 'lucide-react';
import { buildPresentationPDF } from '@/lib/presentationPdf';
import { EMBLEM_URL } from '@/components/Logo';
import PageHeader from '@/components/PageHeader';

export default function PresentationPack() {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await buildPresentationPDF(EMBLEM_URL);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Sorry, the PDF could not be generated. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        icon={FileText}
        title="Presentation Pack"
        subtitle="AI, automation & financial value proposition — a 45-minute briefing, print-ready"
        actions={
          <button onClick={handleDownload} disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#2E5A1A] rounded-lg font-semibold text-sm hover:bg-white/90 transition shadow-sm disabled:opacity-60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Building…' : 'Download PDF'}
          </button>
        }
      />
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-6 py-6 md:px-10 md:py-8 bg-gradient-to-br from-[#f0fdf4] to-slate-50 border-b border-slate-100">
          <img src={EMBLEM_URL} alt="Ground Control" className="h-12 mb-3 object-contain" />
          <p className="text-slate-600 text-sm md:text-base">AI, automation & financial value proposition — a full 45-minute briefing, print-ready.</p>
        </div>

        <div className="p-6 md:p-10">
          <p className="text-slate-600 text-sm leading-relaxed">
            A polished, detailed PDF you can present from or hand out. It opens with an executive summary, covers the
            integrations ecosystem, AI and automation layer, safety and compliance story, field crew experience,
            financial performance, payroll &amp; CIS, predictive maintenance, the client portal, the audit trail and ROI —
            each point backed by a proof line — and finishes with a timed 45-minute agenda plus a ready-to-read
            facilitator script with exactly what to say, show and ask, and ready answers to likely objections.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <PreviewItem icon={FileText} title="Executive Summary" desc="Headline outcomes and the ask, at a glance" />
            <PreviewItem icon={Link2} title="Integrations & Ecosystem" desc="SafetyCulture, Concur, Bob HR, CIS, OpenGround" />
            <PreviewItem icon={Grid3x3} title="Customisable Dashboard" desc="Per-user layouts, drag-and-drop, resize widgets" />
            <PreviewItem icon={ShieldCheck} title="Safety & Compliance" desc="5 points with proof lines + pull quote" />
            <PreviewItem icon={Smartphone} title="Field Crew Experience" desc="Mobile-first, offline, less admin not more" />
            <PreviewItem icon={TrendingUp} title="Financial Performance" desc="5 points with proof lines + pull quote" />
            <PreviewItem icon={Users} title="Payroll & CIS" desc="One-click export, CIS-aware pay, budget alerts" />
            <PreviewItem icon={Sparkles} title="AI & Automation" desc="8 intelligent features with proof lines" />
            <PreviewItem icon={HardHat} title="Predictive Maintenance" desc="Usage-based servicing & rig lockdown" />
            <PreviewItem icon={Building2} title="Client Portal" desc="Verified milestones, controlled visibility" />
            <PreviewItem icon={ScrollText} title="Audit & Compliance Trail" desc="Tamper-evident log + one-click Job Packs" />
            <PreviewItem icon={FileClock} title="Financial Assurance" desc="Unbilled WIP & revenue protection" />
            <PreviewItem icon={GitBranch} title="Competitive Edge" desc="Why this beats off-the-shelf field apps" />
            <PreviewItem icon={Clock} title="Time Savings Chart" desc="Manual vs automated hours, with totals" />
            <PreviewItem icon={TrendingUp} title="Financial ROI" desc="4 return mechanisms + net annual value" />
            <PreviewItem icon={Map} title="45-Minute Agenda" desc="Timed order to cover everything in the meeting" />
            <PreviewItem icon={FileText} title="Facilitator Script" desc="Say / Show / Ask at each step + objection handling" />
          </div>

          <button
            onClick={handleDownload}
            disabled={generating}
            className="mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 command-gradient text-white rounded-xl font-semibold text-sm md:text-base shadow-lg hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {generating ? 'Building PDF…' : 'Download PDF'}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">Takes a few seconds. Opens in your downloads folder.</p>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-emerald-700" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}