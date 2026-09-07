import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { UNIQUE_ENTITY_NAMES, ENTITY_COUNT } from '@/utils/powerapps/entityManifest';
import { generateDataverseSchemaDocument, generateDataverseCSV, generateRelationshipsCSV } from '@/utils/powerapps/dataverseConverter';
import { generateAllFlowsDocument, generateFlowBundles } from '@/utils/powerapps/flowGenerator';
import { FLOW_COUNT } from '@/utils/powerapps/flowManifest';
import { generatePowerFxDocument } from '@/utils/powerapps/powerFxSource';
import { generateIntegrationGuide } from '@/utils/powerapps/integrationGuideContent';
import { generateClaudeBuildBrief } from '@/utils/powerapps/claudeBuildBrief';
import { generateClaudeConversationScript } from '@/utils/powerapps/claudeConversationScript';
import ClaudeBuildCheatSheet from '@/components/powerapps/ClaudeBuildCheatSheet';
import { downloadMarkdown, downloadJSON, downloadCSV, downloadText } from '@/utils/powerapps/download';
import { useToast } from '@/components/ui/use-toast';
import {
  Database, Workflow, Smartphone, Plug, Code, Download, Loader2,
  CheckCircle2, Boxes, ArrowRight, FileDown, Sparkles,
} from 'lucide-react';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';

const VOLUMES = [
  {
    id: 'dataverse',
    title: 'Dataverse Schema Pack',
    subtitle: 'Build manual — paste into Dataverse (make.powerapps.com → Tables)',
    filename: 'GC-Mission-Control-Dataverse-Schema-Pack.md',
    icon: Database,
    color: 'from-blue-600 to-indigo-700',
    generate: (schemaList) => generateDataverseSchemaDocument(schemaList),
    download: (c) => downloadMarkdown('GC-Mission-Control-Dataverse-Schema-Pack.md', c),
    requiresSchemas: true,
  },
  {
    id: 'dataverse-csv',
    title: 'Dataverse Schema Workbook (CSV)',
    subtitle: 'Importable into Excel — one row per column, filterable by table',
    filename: 'GC-Mission-Control-Dataverse-Schema-Workbook.csv',
    icon: Database,
    color: 'from-blue-500 to-cyan-600',
    generate: (schemaList) => generateDataverseCSV(schemaList),
    download: (c) => downloadCSV('GC-Mission-Control-Dataverse-Schema-Workbook.csv', c),
    requiresSchemas: true,
  },
  {
    id: 'relationships-csv',
    title: 'Dataverse Relationships (CSV)',
    subtitle: 'All 1:N, N:N, and child-table relationships — importable into Excel',
    filename: 'GC-Mission-Control-Dataverse-Relationships.csv',
    icon: Database,
    color: 'from-cyan-600 to-teal-700',
    generate: (schemaList) => generateRelationshipsCSV(schemaList),
    download: (c) => downloadCSV('GC-Mission-Control-Dataverse-Relationships.csv', c),
    requiresSchemas: true,
  },
  {
    id: 'flows-doc',
    title: 'Power Automate Flow Pack',
    subtitle: 'Build manual — paste each flow into Power Automate',
    filename: 'GC-Mission-Control-PowerAutomate-Flow-Pack.md',
    icon: Workflow,
    color: 'from-emerald-600 to-teal-700',
    generate: () => generateAllFlowsDocument(),
    download: (c) => downloadMarkdown('GC-Mission-Control-PowerAutomate-Flow-Pack.md', c),
    requiresSchemas: false,
  },
  {
    id: 'flows-json',
    title: 'Flow Bundles (JSON, grouped by trigger)',
    subtitle: 'Structured flow specs — scheduled / instant / webhook bundles for Power Automate',
    filename: 'GC-Mission-Control-Flow-Bundles.json',
    icon: Code,
    color: 'from-teal-600 to-cyan-700',
    generate: () => generateFlowBundles(),
    download: (c) => downloadJSON('GC-Mission-Control-Flow-Bundles.json', c),
    requiresSchemas: false,
  },
  {
    id: 'powerfx',
    title: 'Canvas App Power Fx Source',
    subtitle: 'Build manual — paste into Power Apps Studio (canvas app)',
    filename: 'GC-Mission-Control-Canvas-App-PowerFx-Source.md',
    icon: Smartphone,
    color: 'from-violet-600 to-purple-700',
    generate: () => generatePowerFxDocument(),
    download: (c) => downloadMarkdown('GC-Mission-Control-Canvas-App-PowerFx-Source.md', c),
    requiresSchemas: false,
  },
  {
    id: 'integrations',
    title: 'Integration & Connector Guide',
    subtitle: 'Build manual — configure connectors in Power Automate',
    filename: 'GC-Mission-Control-Integration-Setup-Guide.md',
    icon: Plug,
    color: 'from-amber-600 to-orange-700',
    generate: () => generateIntegrationGuide(),
    download: (c) => downloadMarkdown('GC-Mission-Control-Integration-Setup-Guide.md', c),
    requiresSchemas: false,
  },
];

// Self-contained "Developer Pack" page rendered as the final booklet page.
// Generates the full importable pack (reusing the Build Hub generators) and
// downloads all 5 volumes. Also links to the full Build Hub for a richer UI.
export default function DeveloperPackPage() {
  const { toast } = useToast();
  const [schemas, setSchemas] = useState({});
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaProgress, setSchemaProgress] = useState(0);
  const [genState, setGenState] = useState('idle'); // idle | generating | done | error
  const [genStep, setGenStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [briefBusy, setBriefBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);

  // Fetch all entity schemas in parallel batches (same pattern as the Build Hub)
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
        setSchemaProgress(Math.min(i + batchSize, UNIQUE_ENTITY_NAMES.length));
      }
      if (!cancelled) setSchemaLoading(false);
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async () => {
    if (schemaLoading) {
      toast({
        title: 'Schemas still loading',
        description: 'Please wait for the database schemas to finish loading before generating.',
        variant: 'destructive',
      });
      return;
    }
    setGenState('generating');
    setGenStep(0);
    setFiles([]);
    const out = [];
    const schemaList = UNIQUE_ENTITY_NAMES.map((name) => ({ name, schema: schemas[name] }));
    try {
      for (let i = 0; i < VOLUMES.length; i++) {
        const vol = VOLUMES[i];
        setGenStep(i);
        await new Promise((r) => setTimeout(r, 150));
        const content = vol.generate(schemaList);
        out.push({ ...vol, content });
        setFiles([...out]);
        await new Promise((r) => setTimeout(r, 250));
      }
      setGenStep(VOLUMES.length);
      setGenState('done');
      toast({
        title: 'Developer pack generated',
        description: `${VOLUMES.length} files ready to download.`,
      });
    } catch (e) {
      setGenState('error');
      toast({
        title: 'Generation failed',
        description: e.message || 'An error occurred while generating the pack.',
        variant: 'destructive',
      });
    }
  };

  const handleClaudeBrief = async () => {
    if (schemaLoading) {
      toast({
        title: 'Schemas still loading',
        description: 'Please wait for the database schemas to finish loading first.',
        variant: 'destructive',
      });
      return;
    }
    setBriefBusy(true);
    try {
      const schemaList = UNIQUE_ENTITY_NAMES.map((name) => ({ name, schema: schemas[name] }));
      const content = generateClaudeBuildBrief(schemaList);
      downloadMarkdown('GC-Mission-Control-Claude-Build-Brief.md', content);
      toast({
        title: 'Claude Build Brief downloaded',
        description: 'One file — hand it to Claude to build the whole platform.',
      });
    } catch (e) {
      toast({
        title: 'Brief generation failed',
        description: e.message || 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setBriefBusy(false);
    }
  };

  const handleConversationScript = async () => {
    if (schemaLoading) {
      toast({
        title: 'Schemas still loading',
        description: 'Please wait for the database schemas to finish loading first.',
        variant: 'destructive',
      });
      return;
    }
    setScriptBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const schemaList = UNIQUE_ENTITY_NAMES.map((name) => ({ name, schema: schemas[name] }));
      const content = generateClaudeConversationScript(schemaList);
      downloadText('GC-Mission-Control-Claude-Conversation-Script.txt', content);
      toast({
        title: 'Claude Conversation Script downloaded',
        description: '12 phase prompts — paste each into Claude in order.',
      });
    } catch (e) {
      toast({
        title: 'Script generation failed',
        description: e.message || 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setScriptBusy(false);
    }
  };

  const downloadOne = (file) => {
    try {
      file.download(file.content);
      toast({ title: 'Downloaded', description: file.filename });
    } catch (e) {
      toast({ title: 'Download failed', description: file.filename, variant: 'destructive' });
    }
  };

  const downloadAll = () => {
    let delay = 0;
    files.forEach((file, i) => {
      setTimeout(() => {
        try {
          file.download(file.content);
          toast({ title: `Downloaded (${i + 1}/${files.length})`, description: file.filename });
        } catch (e) {
          toast({ title: 'Download failed', description: file.filename, variant: 'destructive' });
        }
      }, delay);
      delay += 800;
    });
  };

  return (
    <div>
      {/* Page header */}
      <div
        className="rounded-2xl overflow-hidden mb-4 shadow-sm relative"
        style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 50%, ${BRAND_LEAF} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30px,-30px)' }} />
        <div className="px-4 sm:px-5 py-4 text-white relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/85 font-bold mb-0.5">
              Final Step
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold leading-tight">
              Developer Pack — Import Everything into Power Apps
            </h3>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-xl p-3.5 mb-4 bg-slate-50 border-l-4" style={{ borderLeftColor: BRAND_DARK }}>
        <p className="text-[12px] sm:text-[13px] text-slate-700 leading-relaxed">
          <strong>The fast path:</strong> download the <strong>Claude Conversation Script</strong> below
          and paste each phase prompt into Claude — it builds everything end-to-end from one file.
          The <strong>Claude Build Brief</strong> is the same content as a single markdown hand-off.
          The 7 volumes further down are the same content split into separate files for manual pasting.
          Everything also lives on the <Link to="/powerapps-build-hub" className="underline font-semibold" style={{ color: BRAND_DARK }}>Build Hub</Link>.
        </p>
      </div>

      {/* Open Build Hub CTA — the Build Hub is the single home for the script */}
      <Link
        to="/powerapps-build-hub"
        className="rounded-2xl p-4 mb-4 text-white shadow-md relative overflow-hidden flex items-center gap-3 hover:opacity-95 transition group"
        style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 100%)` }}
      >
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Boxes className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold leading-tight">Open the Build Hub — the single home for the Claude script</h3>
          <p className="text-[11px] text-white/80 mt-0.5 leading-relaxed">
            One-click download, 3-step how-to, and the advanced manual-paste volumes all in one place.
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition flex-shrink-0" />
      </Link>

      {/* === Claude Build Brief — single file to hand to an AI builder === */}
      <div
        className="rounded-2xl p-4 mb-4 text-white shadow-md relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 45%, ${BRAND_LEAF} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30px,-30px)' }} />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold leading-tight">Claude Build Brief</h3>
            <p className="text-[11px] sm:text-[12px] text-white/85 mt-1 leading-relaxed">
              One file containing the full build order + all schemas + all flows + all Power Fx +
              the integration guide. Hand it to Claude and it can build the whole platform
              end-to-end from this single document.
            </p>
            <button
              onClick={handleClaudeBrief}
              disabled={briefBusy || schemaLoading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl font-bold text-xs hover:bg-white/90 transition shadow disabled:opacity-60"
              style={{ color: BRAND_DARK }}
            >
              {briefBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating brief…
                </>
              ) : schemaLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading schemas {schemaProgress}/{ENTITY_COUNT}…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download Claude Build Brief
                </>
              )}
            </button>

            <div className="mt-4 pt-3 border-t border-white/20">
              <h4 className="text-sm font-extrabold leading-tight">Claude Conversation Script</h4>
              <p className="text-[11px] text-white/85 mt-0.5 leading-relaxed">
                12 phase prompts with everything inline — paste each into Claude, one phase at a time,
                and it walks you through every click and paste.
              </p>
              <button
                onClick={handleConversationScript}
                disabled={scriptBusy || schemaLoading}
                className="mt-2.5 inline-flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl font-bold text-xs hover:bg-white/90 transition shadow disabled:opacity-60"
                style={{ color: BRAND_DARK }}
              >
                {scriptBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating script…
                  </>
                ) : schemaLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading schemas {schemaProgress}/{ENTITY_COUNT}…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Download Claude Conversation Script
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === How to run this with Claude — handoff + paste targets + time === */}
      <div className="mb-4">
        <ClaudeBuildCheatSheet />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
          <div className="text-lg font-extrabold text-slate-800 tabular-nums">{ENTITY_COUNT}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Dataverse Tables</div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
          <div className="text-lg font-extrabold text-slate-800 tabular-nums">{FLOW_COUNT}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Power Automate Flows</div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
          <div className="text-lg font-extrabold text-slate-800 tabular-nums">7</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Build Volumes</div>
        </div>
      </div>

      {/* === Print-only static snapshot — shows in PDF, hidden on screen === */}
      <div className="print-static-only rounded-xl border border-slate-200 p-4 bg-white">
        <h4 className="text-sm font-bold text-slate-900 mb-2">Developer Pack Contents (7 volumes)</h4>
        <p className="text-[11px] text-slate-600 mb-3">
          Generate the pack on screen to download all 7 files. Each volume is a build manual — paste
          into the named Power Platform tool, or hand the Claude Build Brief to Claude for end-to-end
          execution.
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {VOLUMES.map((vol, i) => {
            const Icon = vol.icon;
            return (
              <div key={vol.id} className="flex items-center gap-2.5 text-[11px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center">{i + 1}</span>
                <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium truncate block">{vol.title}</span>
                  <span className="text-[9px] text-slate-400 truncate block">{vol.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* === Idle: generate button + volume list — hidden in print === */}
      {genState === 'idle' && (
        <div className="print:hidden rounded-xl border border-slate-200 p-4 bg-white text-center">
          {schemaLoading ? (
            <div className="inline-flex items-center gap-2 text-xs text-amber-600 font-semibold mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading database schemas... {schemaProgress}/{ENTITY_COUNT}
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 transition shadow-md mb-3"
              style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12)` }}
            >
              <Boxes className="w-5 h-5" /> Generate &amp; Download Full Pack
            </button>
          )}
          <div className="grid grid-cols-1 gap-1.5 text-left mt-2">
            {VOLUMES.map((vol, i) => {
              const Icon = vol.icon;
              return (
                <div
                  key={vol.id}
                  className="flex items-center gap-2.5 text-[11px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                    {i + 1}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{vol.title}</span>
                    <span className="text-[9px] text-slate-400 truncate block">{vol.subtitle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Generating progress — hidden in print === */}
      {genState === 'generating' && (
        <div className="print:hidden rounded-xl border border-slate-200 p-4 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_DARK }} />
            <div>
              <h4 className="text-sm font-bold text-slate-900">Generating developer pack...</h4>
              <p className="text-[11px] text-slate-500">Reading schemas and producing files</p>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(genStep / VOLUMES.length) * 100}%`, background: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND_LEAF})` }}
            />
          </div>
          <div className="space-y-1.5">
            {VOLUMES.map((vol, i) => {
              const Icon = vol.icon;
              const isDone = i < genStep;
              const isActive = i === genStep;
              return (
                <div key={vol.id} className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-emerald-100' : isActive ? 'bg-emerald-100' : 'bg-slate-100'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: BRAND_DARK }} />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                    )}
                  </div>
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDone ? 'text-emerald-500' : isActive ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span className={`text-[11px] font-medium truncate ${isDone ? 'text-slate-400 line-through' : isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {vol.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Done: download files — hidden in print === */}
      {genState === 'done' && (
        <div className="print:hidden space-y-3">
          <div className="rounded-xl border border-slate-200 p-4 bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pack ready — download all files</h4>
                <p className="text-[11px] text-slate-500">{VOLUMES.length} files generated. Import them into Power Apps.</p>
              </div>
            </div>
            <button
              onClick={downloadAll}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-xs hover:opacity-90 transition shadow"
              style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12)` }}
            >
              <Download className="w-4 h-4" /> Download All Files
            </button>
          </div>
          <div className="space-y-2">
            {files.map((file) => {
              const Icon = file.icon;
              return (
                <div key={file.id} className="rounded-xl border border-slate-200 p-3 bg-white flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${file.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900">{file.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{file.filename}</p>
                  </div>
                  <button
                    onClick={() => downloadOne(file)}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-white rounded-lg font-semibold text-[11px] hover:opacity-90 transition"
                    style={{ background: BRAND_DARK }}
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { setGenState('idle'); setFiles([]); setGenStep(0); }}
            className="text-[11px] text-slate-500 hover:text-slate-700 font-medium"
          >
            Generate again
          </button>
        </div>
      )}

      {/* === Error — hidden in print === */}
      {genState === 'error' && (
        <div className="print:hidden rounded-xl border border-red-200 p-4 bg-red-50 text-center">
          <p className="text-sm font-bold text-red-700 mb-2">Generation failed</p>
          <p className="text-[11px] text-red-500 mb-3">Something went wrong. Please try again.</p>
          <button
            onClick={() => { setGenState('idle'); setFiles([]); setGenStep(0); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold text-xs hover:bg-slate-800 transition"
          >
            Try again
          </button>
        </div>
      )}

      {/* Link to the full Build Hub */}
      <Link
        to="/powerapps-build-hub"
        className="mt-4 rounded-xl border border-slate-200 p-3 bg-white flex items-center gap-3 hover:shadow-md transition group"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND_DARK}, #1c4a12)` }}>
          <Boxes className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-900">Open the full Build Hub</h4>
          <p className="text-[10px] text-slate-500">A richer interface to generate and download each volume individually</p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition flex-shrink-0" />
      </Link>
    </div>
  );
}