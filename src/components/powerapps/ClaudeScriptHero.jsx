import React from 'react';
import { Loader2, Download, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';

// Presentational hero card for the Claude Conversation Script.
// The parent owns schema loading + the download handler so this stays reusable.
export default function ClaudeScriptHero({
  onDownload,
  busy = false,
  schemaLoading = false,
  schemaProgress = 0,
  schemaTotal = 0,
}) {
  return (
    <div
      className="rounded-2xl p-5 md:p-7 text-white shadow-lg relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 45%, ${BRAND_LEAF} 100%)` }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(40px,-40px)' }} />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(-30px,30px)' }} />

      <div className="relative flex items-start gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/85 font-bold mb-0.5">
            The one-click path
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold leading-tight">Claude Conversation Script</h2>
          <p className="text-sm md:text-[15px] text-white/85 mt-1 leading-relaxed">
            12 phase prompts — paste each into Claude and it builds everything for you.
            Every Dataverse schema, Power Automate flow and Power Fx block is inline, so
            Claude never needs another file.
          </p>

          <button
            onClick={onDownload}
            disabled={busy || schemaLoading}
            className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-white rounded-xl font-bold text-sm hover:bg-white/90 transition shadow disabled:opacity-60"
            style={{ color: BRAND_DARK }}
          >
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Generating script…
              </>
            ) : schemaLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading schemas {schemaProgress}/{schemaTotal}…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" /> Download Claude Conversation Script
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3-step "How to use" strip */}
      <div className="relative mt-5 pt-4 border-t border-white/20 grid grid-cols-3 gap-2 md:gap-3">
        {[
          { n: 1, label: 'Download', desc: 'the .txt file' },
          { n: 2, label: 'Open Claude', desc: 'new chat' },
          { n: 3, label: 'Paste each phase', desc: 'one at a time' },
        ].map((s) => (
          <div key={s.n} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1.5 font-bold text-sm">
              {s.n}
            </div>
            <div className="text-xs md:text-sm font-bold leading-tight">{s.label}</div>
            <div className="text-[10px] md:text-[11px] text-white/70 leading-tight mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}