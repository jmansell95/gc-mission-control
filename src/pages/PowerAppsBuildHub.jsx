import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UNIQUE_ENTITY_NAMES, ENTITY_COUNT } from '@/utils/powerapps/entityManifest';
import { generateDataverseSchemaDocument, generateDataverseCSV, generateRelationshipsCSV } from '@/utils/powerapps/dataverseConverter';
import { generateAllFlowsDocument, generateFlowBundles } from '@/utils/powerapps/flowGenerator';
import { FLOW_COUNT } from '@/utils/powerapps/flowManifest';
import { generatePowerFxDocument } from '@/utils/powerapps/powerFxSource';
import { generateIntegrationGuide } from '@/utils/powerapps/integrationGuideContent';
import { generateClaudeConversationScript } from '@/utils/powerapps/claudeConversationScript';
import { downloadMarkdown, downloadJSON, downloadCSV, downloadText } from '@/utils/powerapps/download';
import { useToast } from '@/components/ui/use-toast';
import ClaudeScriptHero from '@/components/powerapps/ClaudeScriptHero';
import {
  Database, Workflow, Smartphone, Plug, FileDown, Loader2, CheckCircle2,
  AlertCircle, Code, Boxes, ArrowLeft, Download, RefreshCw, FileText, Wrench
} from 'lucide-react';
import { Link } from 'react-router-dom';

const BRAND_DARK = '#2E5A1A';

export default function PowerAppsBuildHub() {
  const { toast } = useToast();
  const [schemas, setSchemas] = useState({});
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaProgress, setSchemaProgress] = useState(0);

  // Generation state: 'idle' | 'generating' | 'done' | 'error'
  const [genState, setGenState] = useState('idle');
  const [genStep, setGenStep] = useState(0); // 0-4 for the 5 volumes
  const [generatedFiles, setGeneratedFiles] = useState([]); // {id, title, filename, icon, download}
  const [scriptBusy, setScriptBusy] = useState(false);

  // The 5 volumes — generated in order
  const VOLUMES = [
    {
      id: 'dataverse',
      title: 'Dataverse Schema Pack',
      filename: 'GC-Mission-Control-Dataverse-Schema-Pack.md',
      icon: Database,
      color: 'blue',
      generate: (schemaList) => generateDataverseSchemaDocument(schemaList),
      download: (content) => downloadMarkdown('GC-Mission-Control-Dataverse-Schema-Pack.md', content),
      requiresSchemas: true,
    },
    {
      id: 'dataverse-csv',
      title: 'Dataverse Schema Workbook (CSV)',
      filename: 'GC-Mission-Control-Dataverse-Schema-Workbook.csv',
      icon: Database,
      color: 'blue',
      generate: (schemaList) => generateDataverseCSV(schemaList),
      download: (content) => downloadCSV('GC-Mission-Control-Dataverse-Schema-Workbook.csv', content),
      requiresSchemas: true,
    },
    {
      id: 'relationships-csv',
      title: 'Dataverse Relationships (CSV)',
      filename: 'GC-Mission-Control-Dataverse-Relationships.csv',
      icon: Database,
      color: 'teal',
      generate: (schemaList) => generateRelationshipsCSV(schemaList),
      download: (content) => downloadCSV('GC-Mission-Control-Dataverse-Relationships.csv', content),
      requiresSchemas: true,
    },
    {
      id: 'flows-doc',
      title: 'Power Automate Flow Pack',
      filename: 'GC-Mission-Control-PowerAutomate-Flow-Pack.md',
      icon: Workflow,
      color: 'emerald',
      generate: () => generateAllFlowsDocument(),
      download: (content) => downloadMarkdown('GC-Mission-Control-PowerAutomate-Flow-Pack.md', content),
      requiresSchemas: false,
    },
    {
      id: 'flows-json',
      title: 'Flow Bundles (JSON, grouped)',
      filename: 'GC-Mission-Control-Flow-Bundles.json',
      icon: Code,
      color: 'teal',
      generate: () => generateFlowBundles(),
      download: (content) => downloadJSON('GC-Mission-Control-Flow-Bundles.json', content),
      requiresSchemas: false,
    },
    {
      id: 'powerfx',
      title: 'Canvas App Power Fx Source',
      filename: 'GC-Mission-Control-Canvas-App-PowerFx-Source.md',
      icon: Smartphone,
      color: 'violet',
      generate: () => generatePowerFxDocument(),
      download: (content) => downloadMarkdown('GC-Mission-Control-Canvas-App-PowerFx-Source.md', content),
      requiresSchemas: false,
    },
    {
      id: 'integrations',
      title: 'Integration & Connector Guide',
      filename: 'GC-Mission-Control-Integration-Setup-Guide.md',
      icon: Plug,
      color: 'amber',
      generate: () => generateIntegrationGuide(),
      download: (content) => downloadMarkdown('GC-Mission-Control-Integration-Setup-Guide.md', content),
      requiresSchemas: false,
    },
  ];

  // Fetch all entity schemas in parallel batches
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      const batchSize = 10;
      for (let i = 0; i < UNIQUE_ENTITY_NAMES.length; i += batchSize) {
        if (cancelled) return;
        const batch = UNIQUE_ENTITY_NAMES.slice(i, i + batchSize);
        await Promise.all(batch.map(async (name) => {
          try {
            const schema = await base44.entities[name].schema();
            results[name] = schema;
          } catch (e) {
            results[name] = null;
          }
        }));
        setSchemas({ ...results });
        setSchemaProgress(Math.min(i + batchSize, UNIQUE_ENTITY_NAMES.length));
      }
      if (!cancelled) setSchemaLoading(false);
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // Generate all 5 volumes and store the content for download
  const handleGenerateAll = async () => {
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
    setGeneratedFiles([]);

    const files = [];
    const schemaList = UNIQUE_ENTITY_NAMES.map(name => ({ name, schema: schemas[name] }));

    try {
      for (let i = 0; i < VOLUMES.length; i++) {
        const vol = VOLUMES[i];
        setGenStep(i);

        // Small delay so the UI can update
        await new Promise(r => setTimeout(r, 150));

        let content;
        try {
          content = vol.generate(schemaList);
        } catch (e) {
          console.error(`Error generating ${vol.id}:`, e);
          toast({
            title: `Generation error: ${vol.title}`,
            description: e.message || 'Unknown error',
            variant: 'destructive',
          });
          throw e;
        }

        files.push({
          id: vol.id,
          title: vol.title,
          filename: vol.filename,
          icon: vol.icon,
          color: vol.color,
          content,
          download: vol.download,
        });
        setGeneratedFiles([...files]);

        // Small delay between volumes for UI feedback
        await new Promise(r => setTimeout(r, 300));
      }

      setGenStep(VOLUMES.length);
      setGenState('done');
      toast({
        title: 'Build pack generated',
        description: `${VOLUMES.length} files ready to download. Click each one below.`,
      });
    } catch (e) {
      setGenState('error');
      toast({
        title: 'Generation failed',
        description: e.message || 'An error occurred while generating the build pack.',
        variant: 'destructive',
      });
    }
  };

  // Download a single file
  const handleDownloadFile = (file) => {
    try {
      file.download(file.content);
      toast({
        title: 'Downloaded',
        description: file.filename,
      });
    } catch (e) {
      console.error('Download error:', e);
      toast({
        title: 'Download failed',
        description: `${file.filename}: ${e.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  // Download the Claude Conversation Script (the primary one-click path)
  const handleDownloadScript = async () => {
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

  // Download all files one by one (with user-initiated clicks, not auto)
  const handleDownloadAll = () => {
    let delay = 0;
    generatedFiles.forEach((file, i) => {
      setTimeout(() => {
        try {
          file.download(file.content);
          toast({
            title: `Downloaded (${i + 1}/${generatedFiles.length})`,
            description: file.filename,
          });
        } catch (e) {
          toast({
            title: 'Download failed',
            description: `${file.filename}: ${e.message}`,
            variant: 'destructive',
          });
        }
      }, delay);
      delay += 800; // 800ms between downloads to avoid browser blocking
    });
  };

  const colorClasses = {
    blue: 'from-blue-600 to-indigo-700',
    emerald: 'from-emerald-600 to-teal-700',
    teal: 'from-teal-600 to-cyan-700',
    violet: 'from-violet-600 to-purple-700',
    amber: 'from-amber-600 to-orange-700',
  };

  return (
    <div className="min-h-screen page-bg-vibrant">
      {/* Hero header */}
      <div className="hero-vibrant text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Boxes className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Power Apps Build Hub</h1>
              <p className="text-white/70 text-sm md:text-base">Generate the complete build pack for your developer</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 md:px-4 md:py-3 border border-white/10">
              <div className="text-xl md:text-2xl font-bold tabular-nums">{ENTITY_COUNT}</div>
              <div className="text-[10px] md:text-xs text-white/60 uppercase tracking-wide">Dataverse Tables</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 md:px-4 md:py-3 border border-white/10">
              <div className="text-xl md:text-2xl font-bold tabular-nums">{FLOW_COUNT}</div>
              <div className="text-[10px] md:text-xs text-white/60 uppercase tracking-wide">Power Automate Flows</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 md:px-4 md:py-3 border border-white/10">
              <div className="text-xl md:text-2xl font-bold tabular-nums">12</div>
              <div className="text-[10px] md:text-xs text-white/60 uppercase tracking-wide">Canvas App Screens</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 md:px-4 md:py-3 border border-white/10">
              <div className="text-xl md:text-2xl font-bold tabular-nums">16</div>
              <div className="text-[10px] md:text-xs text-white/60 uppercase tracking-wide">Integrations</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-4">
        {/* === Primary: Claude Conversation Script hero === */}
        <ClaudeScriptHero
          onDownload={handleDownloadScript}
          busy={scriptBusy}
          schemaLoading={schemaLoading}
          schemaProgress={schemaProgress}
          schemaTotal={ENTITY_COUNT}
        />

        {/* === Advanced — manual paste (optional) === */}
        <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Wrench className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wide">Advanced — manual paste (optional)</h3>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            Prefer to paste each piece yourself? Generate the individual build volumes below.
            The Claude Conversation Script above already contains all of this inline.
          </p>

        {/* === Step 1: Generate === */}
        {genState === 'idle' && (
          <div className="insight-card rounded-2xl p-6 md:p-8 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FileDown className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Generate Complete Build Pack</h2>
            <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">
              Click the button below to generate all 5 volumes of the Power Platform migration build manual.
              This reads your live database schemas and produces developer-ready files.
            </p>

            {schemaLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-amber-600 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading database schemas... {schemaProgress}/{ENTITY_COUNT}
              </div>
            ) : (
              <button
                onClick={handleGenerateAll}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm md:text-base hover:bg-slate-800 transition shadow-lg"
              >
                <Boxes className="w-5 h-5" /> Generate Build Pack
              </button>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {VOLUMES.map((vol, i) => {
                const Icon = vol.icon;
                return (
                  <div key={vol.id} className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center">{i + 1}</span>
                    <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium truncate">{vol.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === Step 2: Generating progress === */}
        {genState === 'generating' && (
          <div className="insight-card rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Generating build pack...</h2>
                <p className="text-sm text-slate-500">Reading schemas and producing developer-ready files</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full transition-all duration-300"
                style={{ width: `${(genStep / VOLUMES.length) * 100}%` }}
              />
            </div>

            {/* Step list */}
            <div className="space-y-2">
              {VOLUMES.map((vol, i) => {
                const Icon = vol.icon;
                const isDone = i < genStep;
                const isActive = i === genStep;
                return (
                  <div key={vol.id} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                      isDone ? 'bg-emerald-100' : isActive ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isDone ? 'text-emerald-500' : isActive ? 'text-blue-500' : 'text-slate-300'}`} />
                      <span className={`text-sm font-medium truncate ${isDone ? 'text-slate-400 line-through' : isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                        {vol.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === Step 3: Done — download files === */}
        {genState === 'done' && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="insight-card rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Build pack ready</h2>
                  <p className="text-sm text-slate-500">{VOLUMES.length} files generated. Download each one and hand them to your developer.</p>
                </div>
              </div>

              <button
                onClick={handleDownloadAll}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-md mb-2"
              >
                <Download className="w-5 h-5" /> Download All Files
              </button>
              <p className="text-xs text-slate-400 text-center">
                Files download one at a time (800ms apart) to avoid browser blocking.
              </p>
            </div>

            {/* File list */}
            <div className="space-y-3">
              {generatedFiles.map((file, i) => {
                const Icon = file.icon;
                return (
                  <div key={file.id} className="insight-card rounded-2xl p-4 md:p-5">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${colorClasses[file.color]} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm md:text-base font-bold text-slate-900">{file.title}</h3>
                        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{file.filename}</p>
                      </div>
                      <button
                        onClick={() => handleDownloadFile(file)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-xs md:text-sm hover:bg-slate-800 transition whitespace-nowrap"
                      >
                        <FileDown className="w-4 h-4" /> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Regenerate button */}
            <div className="text-center pt-2">
              <button
                onClick={() => { setGenState('idle'); setGeneratedFiles([]); setGenStep(0); }}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                <RefreshCw className="w-4 h-4" /> Generate again
              </button>
            </div>
          </div>
        )}

        {/* === Error state === */}
        {genState === 'error' && (
          <div className="insight-card rounded-2xl p-6 md:p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Generation failed</h2>
            <p className="text-sm text-slate-500 mb-5">Something went wrong while generating the build pack. Please try again.</p>
            <button
              onClick={() => { setGenState('idle'); setGeneratedFiles([]); setGenStep(0); }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        </div>{/* end Advanced wrapper */}

        {/* === How this works note === */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>The fast path:</strong> download the Claude Conversation Script above and paste each
            phase prompt into Claude — it builds everything end-to-end. The {VOLUMES.length} volumes in
            the Advanced section are the same content split into separate files for manual pasting
            (Dataverse schemas, CSV workbook, relationships, {FLOW_COUNT} Power Automate flows,
            canvas app Power Fx, and the 16-connector integration guide).
          </div>
        </div>

        {/* === Link to Migration Roadmap === */}
        <Link
          to="/powerapps-migration-roadmap"
          className="insight-card rounded-2xl p-4 md:p-5 flex items-center gap-3 hover:shadow-lg transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Migration Roadmap & A4 Booklet</h3>
            <p className="text-xs text-slate-500">See the 12-phase plan and download the full PDF (script embedded)</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-400 rotate-180 group-hover:translate-x-1 transition" />
        </Link>
      </div>
    </div>
  );
}