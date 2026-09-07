import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UNIQUE_ENTITY_NAMES, ENTITY_COUNT } from '@/utils/powerapps/entityManifest';
import { generateClaudeConversationScript } from '@/utils/powerapps/claudeConversationScript';
import { Sparkles, MessageSquare, Loader2 } from 'lucide-react';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';

// Self-contained A4 booklet page that renders the full Claude Conversation Script
// inline. Fetches its own schemas (same pattern as DeveloperPackPage) so the
// Roadmap page stays unchanged. The script text is generated once schemas load.
export default function ClaudeScriptBookletPage() {
  const [schemas, setSchemas] = useState({});
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [scriptText, setScriptText] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      const batchSize = 10;
      for (let i = 0; i < UNIQUE_ENTITY_NAMES.length; i += batchSize) {
        if (cancelled) return;
        const batch = UNIQUE_ENTITY_NAMES.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (name) => {
            try {
              results[name] = await base44.entities[name].schema();
            } catch (e) {
              results[name] = null;
            }
          })
        );
        setSchemas({ ...results });
      }
      if (cancelled) return;
      setSchemaLoading(false);
      try {
        const schemaList = UNIQUE_ENTITY_NAMES.map((name) => ({ name, schema: results[name] }));
        setScriptText(generateClaudeConversationScript(schemaList));
      } catch (e) {
        setScriptText('Error generating script: ' + (e.message || 'unknown'));
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // Split into prompt blocks. Each block starts with a "PROMPT N" header line
  // (or the script header) and runs to the next block.
  const blocks = [];
  if (scriptText) {
    const lines = scriptText.split('\n');
    let current = null;
    for (const line of lines) {
      if (/^PROMPT \d+/.test(line) || line.startsWith('GC MISSION CONTROL — CLAUDE')) {
        if (current) blocks.push(current);
        current = { header: line, body: [] };
      } else if (current) {
        current.body.push(line);
      }
    }
    if (current) blocks.push(current);
  }

  return (
    <section className="print-page mb-6 sm:mb-0">
      {/* Page header */}
      <div className="rounded-xl px-4 py-2.5 mb-4 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12)` }}>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Claude Conversation Script — Full Text
        </h2>
        <p className="text-xs text-white/70">
          Paste each prompt into Claude in order. Every schema, flow and Power Fx block is inline —
          Claude builds the whole platform from this page alone.
        </p>
      </div>

      {/* Intro / how-to */}
      <div className="rounded-xl p-3.5 mb-4 bg-slate-50 border-l-4" style={{ borderLeftColor: BRAND_LEAF }}>
        <p className="text-[12px] text-slate-700 leading-relaxed">
          <strong>How to use:</strong> Open claude.ai → start one new chat → paste Prompt 0 (the role
          prompt) → then paste each phase prompt in order, replying "next" between batches. Each
          prompt contains its own validation checkpoint. When Phase 11 passes, the platform is live.
        </p>
      </div>

      {schemaLoading || !scriptText ? (
        <div className="rounded-xl border border-slate-200 p-6 bg-white text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: BRAND_DARK }} />
          <p className="text-xs text-slate-500">Loading schemas and generating the full script…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, i) => {
            const isIntro = block.header.includes('CLAUDE CONVERSATION SCRIPT');
            const accent = isIntro ? BRAND_LEAF : BRAND_DARK;
            const body = block.body.join('\n').trim();
            return (
              <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 text-white flex items-center gap-2" style={{ background: accent }}>
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-[11px] font-bold tracking-wide truncate">
                    {isIntro ? 'SCRIPT HEADER — HOW TO USE' : block.header}
                  </span>
                </div>
                <pre className="claude-script-block bg-slate-50 text-slate-800 text-[9px] leading-[1.35] p-3 m-0 whitespace-pre-wrap break-words font-mono max-w-full">
{body}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-4 rounded-xl px-4 py-3 text-white text-center" style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12 50%, ${BRAND_LEAF})` }}>
        <p className="text-[10px] font-semibold">
          End of Claude Conversation Script · Paste each prompt into Claude in order · GC Mission Control Power Platform Migration
        </p>
      </div>
    </section>
  );
}