import React from 'react';
import { Sparkles, User, Bot, ArrowRight, Clock, Database, Workflow, Smartphone, Plug, Code } from 'lucide-react';
import { PHASE_TIMELINE, totalWeeks } from '@/utils/powerapps/migrationPhases';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';

// Where each generated volume gets pasted — mirrors the subtitle on each
// volume card so the cheat-sheet is self-contained.
const VOLUME_TARGETS = [
  { icon: Database, title: 'Dataverse Schema Pack', target: 'make.powerapps.com → Solutions → New table' },
  { icon: Workflow, title: 'Power Automate Flow Pack', target: 'make.powerautomate.com → Create flow' },
  { icon: Code, title: 'Flow Definitions (JSON)', target: 'Power Automate → Import (or paste into each flow)' },
  { icon: Smartphone, title: 'Canvas App Power Fx Source', target: 'Power Apps Studio → canvas app screen' },
  { icon: Plug, title: 'Integration & Connector Guide', target: 'Power Automate → Connections + provider dashboards' },
];

export default function ClaudeBuildCheatSheet() {
  const total = totalWeeks();

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
      {/* Header */}
      <div
        className="px-4 py-3.5 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 100%)` }}
      >
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(25px,-25px)' }} />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold leading-tight">How to run this with Claude</h3>
            <p className="text-[11px] text-white/80 mt-0.5">The handoff, the paste targets, and the time it takes</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Intro */}
        <p className="text-[12px] sm:text-[13px] text-slate-700 leading-relaxed">
          Download the <strong>Claude Build Brief</strong> above and hand that one file to Claude.
          Claude reads the build order, produces the exact table definitions, flow JSON, and Power Fx
          for each phase, and tells you precisely where each piece goes. You (or a maker) then paste each
          piece into the Power Platform web UIs — Power Platform has no single "upload and build
          everything" import, so a human does the final paste. Validate after each phase before moving on.
        </p>

        {/* Claude does / You do */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Bot className="w-4 h-4" style={{ color: BRAND_DARK }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND_DARK }}>Claude does</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-700 leading-relaxed">
              <li className="flex gap-1.5"><span style={{ color: BRAND_DARK }}>→</span> Reads the Build Brief end-to-end</li>
              <li className="flex gap-1.5"><span style={{ color: BRAND_DARK }}>→</span> Generates every schema, flow & Power Fx block</li>
              <li className="flex gap-1.5"><span style={{ color: BRAND_DARK }}>→</span> Gives step-by-step paste instructions per phase</li>
              <li className="flex gap-1.5"><span style={{ color: BRAND_DARK }}>→</span> Refines step-level timing as it builds</li>
            </ul>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 mb-2">
              <User className="w-4 h-4 text-slate-600" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">You do</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-700 leading-relaxed">
              <li className="flex gap-1.5"><span className="text-slate-400">→</span> Paste each piece into the named Power Platform tool</li>
              <li className="flex gap-1.5"><span className="text-slate-400">→</span> Click through make.powerapps.com / powerautomate.com</li>
              <li className="flex gap-1.5"><span className="text-slate-400">→</span> Register webhook URLs in provider dashboards</li>
              <li className="flex gap-1.5"><span className="text-slate-400">→</span> Validate record counts & test runs after each phase</li>
            </ul>
          </div>
        </div>

        {/* Volume → paste target */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Where each file goes</div>
          <div className="space-y-1.5">
            {VOLUME_TARGETS.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BRAND_DARK }} />
                  <span className="text-[11px] font-semibold text-slate-800 flex-shrink-0 min-w-0">{v.title}</span>
                  <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] text-slate-500 truncate">{v.target}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-phase time table */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
            <Clock className="w-3.5 h-3.5" /> Time per phase
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
              <div className="col-span-1 px-2 py-1.5 text-center">P</div>
              <div className="col-span-8 px-2 py-1.5">Phase</div>
              <div className="col-span-3 px-2 py-1.5 text-right">Weeks</div>
            </div>
            <div className="divide-y divide-slate-100">
              {PHASE_TIMELINE.map((p) => (
                <div key={p.n} className="grid grid-cols-12 text-[11px] hover:bg-slate-50">
                  <div className="col-span-1 px-2 py-1.5 text-center font-bold" style={{ color: BRAND_DARK }}>{p.n}</div>
                  <div className="col-span-8 px-2 py-1.5 text-slate-700">{p.name}</div>
                  <div className="col-span-3 px-2 py-1.5 text-right font-semibold text-slate-800 tabular-nums">{p.weeks}w</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12)` }}>
              <div className="col-span-9 px-2 py-2">Total (critical path, with parallelism)</div>
              <div className="col-span-3 px-2 py-2 text-right tabular-nums">{total}w</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
            Phase-level estimates only. When you hand Claude the Build Brief and start a phase, it will
            break that phase into steps and give you a more granular timing estimate as it goes.
          </p>
        </div>
      </div>
    </div>
  );
}