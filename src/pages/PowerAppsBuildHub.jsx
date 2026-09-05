import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UNIQUE_ENTITY_NAMES, ENTITY_COUNT } from '@/utils/powerapps/entityManifest';
import { generateDataverseSchemaDocument } from '@/utils/powerapps/dataverseConverter';
import { generateAllFlowsDocument, generateAllFlowJSONs } from '@/utils/powerapps/flowGenerator';
import { FLOW_COUNT } from '@/utils/powerapps/flowManifest';
import { generatePowerFxDocument } from '@/utils/powerapps/powerFxSource';
import { generateIntegrationGuide } from '@/utils/powerapps/integrationGuideContent';
import { downloadMarkdown, downloadJSON } from '@/utils/powerapps/download';
import {
  Database, Workflow, Smartphone, Plug, FileDown, Loader2, CheckCircle2,
  AlertCircle, FileText, Code, Boxes, Zap
} from 'lucide-react';

export default function PowerAppsBuildHub() {
  const [schemas, setSchemas] = useState({});
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaProgress, setSchemaProgress] = useState(0);
  const [generating, setGenerating] = useState(null);

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

  const handleDownloadDataverse = () => {
    setGenerating('dataverse');
    try {
      const schemaList = UNIQUE_ENTITY_NAMES.map(name => ({ name, schema: schemas[name] }));
      const doc = generateDataverseSchemaDocument(schemaList);
      downloadMarkdown('GC-Mission-Control-Dataverse-Schema-Pack.md', doc);
    } catch (e) {
      console.error(e);
    }
    setGenerating(null);
  };

  const handleDownloadFlowsDoc = () => {
    setGenerating('flows-doc');
    try {
      const doc = generateAllFlowsDocument();
      downloadMarkdown('GC-Mission-Control-PowerAutomate-Flow-Pack.md', doc);
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const handleDownloadFlowsJSON = () => {
    setGenerating('flows-json');
    try {
      const jsons = generateAllFlowJSONs();
      downloadJSON('GC-Mission-Control-Flow-Definitions.json', jsons);
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const handleDownloadPowerFx = () => {
    setGenerating('powerfx');
    try {
      const doc = generatePowerFxDocument();
      downloadMarkdown('GC-Mission-Control-Canvas-App-PowerFx-Source.md', doc);
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const handleDownloadIntegrationGuide = () => {
    setGenerating('integrations');
    try {
      const doc = generateIntegrationGuide();
      downloadMarkdown('GC-Mission-Control-Integration-Setup-Guide.md', doc);
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const handleDownloadAll = async () => {
    setGenerating('all');
    try {
      // 1. Dataverse schema
      const schemaList = UNIQUE_ENTITY_NAMES.map(name => ({ name, schema: schemas[name] }));
      downloadMarkdown('GC-Mission-Control-Dataverse-Schema-Pack.md', generateDataverseSchemaDocument(schemaList));
      await new Promise(r => setTimeout(r, 600));
      // 2. Flows doc
      downloadMarkdown('GC-Mission-Control-PowerAutomate-Flow-Pack.md', generateAllFlowsDocument());
      await new Promise(r => setTimeout(r, 600));
      // 3. Flows JSON
      downloadJSON('GC-Mission-Control-Flow-Definitions.json', generateAllFlowJSONs());
      await new Promise(r => setTimeout(r, 600));
      // 4. Power Fx
      downloadMarkdown('GC-Mission-Control-Canvas-App-PowerFx-Source.md', generatePowerFxDocument());
      await new Promise(r => setTimeout(r, 600));
      // 5. Integration guide
      downloadMarkdown('GC-Mission-Control-Integration-Setup-Guide.md', generateIntegrationGuide());
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const volumes = [
    {
      id: 'dataverse',
      icon: Database,
      title: 'Volume 1 — Dataverse Schema Pack',
      subtitle: `${ENTITY_COUNT} tables · every column, choice, relationship, RLS rule`,
      gradient: 'from-blue-600 to-indigo-700',
      stats: `${schemaProgress}/${ENTITY_COUNT} schemas loaded`,
      ready: !schemaLoading,
      onDownload: handleDownloadDataverse,
      filename: 'GC-Mission-Control-Dataverse-Schema-Pack.md',
    },
    {
      id: 'flows-doc',
      icon: Workflow,
      title: 'Volume 2 — Power Automate Flow Pack',
      subtitle: `${FLOW_COUNT} flows · trigger config, action steps, expressions`,
      gradient: 'from-emerald-600 to-teal-700',
      stats: `${FLOW_COUNT} flow definitions ready`,
      ready: true,
      onDownload: handleDownloadFlowsDoc,
      filename: 'GC-Mission-Control-PowerAutomate-Flow-Pack.md',
    },
    {
      id: 'flows-json',
      icon: Code,
      title: 'Volume 2b — Flow Definitions (JSON)',
      subtitle: 'Machine-readable flow specs for all functions',
      gradient: 'from-teal-600 to-cyan-700',
      stats: `${FLOW_COUNT} JSON definitions`,
      ready: true,
      onDownload: handleDownloadFlowsJSON,
      filename: 'GC-Mission-Control-Flow-Definitions.json',
    },
    {
      id: 'powerfx',
      icon: Smartphone,
      title: 'Volume 3 — Canvas App Power Fx Source',
      subtitle: 'Every screen · galleries, forms, GPS, camera, offline sync',
      gradient: 'from-violet-600 to-purple-700',
      stats: '12 screens · full Power Fx source',
      ready: true,
      onDownload: handleDownloadPowerFx,
      filename: 'GC-Mission-Control-Canvas-App-PowerFx-Source.md',
    },
    {
      id: 'integrations',
      icon: Plug,
      title: 'Volume 4 — Integration & Connector Guide',
      subtitle: '16 integrations · setup steps, auth, endpoints, expressions',
      gradient: 'from-amber-600 to-orange-700',
      stats: '16 integrations covered',
      ready: true,
      onDownload: handleDownloadIntegrationGuide,
      filename: 'GC-Mission-Control-Integration-Setup-Guide.md',
    },
  ];

  return (
    <div className="min-h-screen page-bg-vibrant">
      {/* Hero header */}
      <div className="hero-vibrant text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Boxes className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">Power Apps Build Hub</h1>
              <p className="text-white/70 text-sm md:text-base">Complete downloadable build manual for the Power Platform migration</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold tabular-nums">{ENTITY_COUNT}</div>
              <div className="text-xs text-white/60 uppercase tracking-wide">Dataverse Tables</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold tabular-nums">{FLOW_COUNT}</div>
              <div className="text-xs text-white/60 uppercase tracking-wide">Power Automate Flows</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold tabular-nums">12</div>
              <div className="text-xs text-white/60 uppercase tracking-wide">Canvas App Screens</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold tabular-nums">16</div>
              <div className="text-xs text-white/60 uppercase tracking-wide">Integrations</div>
            </div>
          </div>

          {/* Download all button */}
          <div className="mt-6">
            <button
              onClick={handleDownloadAll}
              disabled={generating === 'all' || schemaLoading}
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm md:text-base hover:bg-white/90 transition shadow-lg disabled:opacity-50"
            >
              {generating === 'all' ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating all volumes...</>
              ) : (
                <><FileDown className="w-5 h-5" /> Download Everything</>
              )}
            </button>
            {schemaLoading && (
              <span className="ml-3 text-sm text-white/70 inline-flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading schemas... {schemaProgress}/{ENTITY_COUNT}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Volume cards */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-4">
        {volumes.map(vol => {
          const Icon = vol.icon;
          const isGenerating = generating === vol.id;
          return (
            <div key={vol.id} className="insight-card rounded-2xl overflow-hidden relative">
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-5 md:p-6">
                {/* Icon */}
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${vol.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-slate-900">{vol.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{vol.subtitle}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {vol.ready ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {vol.stats}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {vol.stats}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono truncate">{vol.filename}</span>
                  </div>
                </div>

                {/* Download button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={vol.onDownload}
                    disabled={!vol.ready || isGenerating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    ) : (
                      <><FileDown className="w-4 h-4" /> Download</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Build order guide */}
        <div className="insight-card rounded-2xl p-5 md:p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-base md:text-lg font-bold text-slate-900">Recommended Build Order</h2>
          </div>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">1</span>
              <span><strong className="text-slate-900">Download Volume 1</strong> — create the Dataverse solution and all tables first. This is the foundation everything else depends on.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">2</span>
              <span><strong className="text-slate-900">Set up Entra ID SSO</strong> (Volume 4, Section 1) — so users can log in to the canvas app.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">3</span>
              <span><strong className="text-slate-900">Download Volume 3</strong> — build the canvas app screens in Power Apps Studio.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">4</span>
              <span><strong className="text-slate-900">Download Volume 2</strong> — create the Power Automate flows. Start with the scheduled check/sync flows, then the instant flows, then the webhook receivers.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">5</span>
              <span><strong className="text-slate-900">Download Volume 4</strong> — wire up each external integration (Geotab, Asset Panda, KeyLogBook, etc.) one at a time, testing each webhook flow.</span>
            </li>
          </ol>
        </div>

        {/* Note */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>How this works:</strong> The schema pack reads your live Base44 entity definitions and converts them to Dataverse table specs in real time. The flow pack generates a Power Automate flow definition for every one of the {FLOW_COUNT} backend functions, categorised by trigger type and logic pattern. Each download is a Markdown or JSON file you can open in any text editor or import into your documentation tool.
          </div>
        </div>
      </div>
    </div>
  );
}