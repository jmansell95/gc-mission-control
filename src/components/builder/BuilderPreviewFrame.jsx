import React, { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

/**
 * BuilderPreviewFrame — shared preview chrome used by both the Email Template
 * Builder and the Report Template Builder. Renders a device toggle (desktop /
 * mobile) and an iframe-style preview surface so admins see exactly how the
 * output will look. The `html` prop is the full HTML document string.
 */
export default function BuilderPreviewFrame({ html, label = 'Preview', emptyHint = 'Select a template to preview' }) {
  const [device, setDevice] = useState('desktop');

  if (!html) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 min-h-[400px]">
        <p className="text-sm text-slate-400">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Device toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => setDevice('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${device === 'desktop' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
          <button onClick={() => setDevice('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${device === 'mobile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      </div>
      {/* Preview surface */}
      <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 p-3 overflow-hidden flex justify-center">
        <iframe
          srcDoc={html}
          title={label}
          className={`bg-white rounded-lg shadow-sm border border-slate-200 transition-all duration-300 ${device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full max-w-[640px]'}`}
          style={{ height: '100%', minHeight: '420px', border: 'none' }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}