import React from 'react';
import { Link2, Zap } from 'lucide-react';

/**
 * Live Integration Health — bento widget for the Settings Command Hub.
 *
 * Renders a compact strip of per-integration status pills (connected vs
 * missing credentials) with a one-tap "Fix" link into the integration
 * config drawer.
 *
 * Props:
 *  - integrations: [{ id, label, connected }]
 *  - onNavigate: (id) => void   // id is the settings tab id to fix
 */
export default function IntegrationHealthWidget({ integrations = [], onNavigate }) {
  const connected = integrations.filter(i => i.connected).length;
  const total = integrations.length;
  const allOk = connected === total;

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
          <Link2 className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">Integration Health</h3>
          <p className="text-[11px] text-slate-500 font-medium">
            {allOk
              ? `All ${total} integrations connected`
              : `${connected} of ${total} connected — tap to fix`}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {connected}/{total}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {integrations.map(i => (
          <button
            key={i.id}
            type="button"
            onClick={() => !i.connected && onNavigate(i.id)}
            disabled={i.connected}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition flex-shrink-0 ${
              i.connected
                ? 'bg-emerald-50 text-emerald-700 cursor-default'
                : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700 active:scale-95'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {i.label}
            {!i.connected && <Zap className="w-3 h-3 text-amber-500" />}
          </button>
        ))}
      </div>
    </div>
  );
}