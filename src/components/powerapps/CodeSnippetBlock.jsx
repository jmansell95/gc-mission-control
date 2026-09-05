import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Dark monospace code block with a language label tab and a copy button.
// Used on every phase page of the Power Apps Migration booklet.
export default function CodeSnippetBlock({ language, code, title }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* clipboard not available — ignore */
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/40 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex-shrink-0">
            {language}
          </span>
          {title && (
            <span className="text-[10px] text-slate-400 truncate">· {title}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="print:hidden inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white transition flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre
        className="px-3 py-2.5 overflow-x-auto text-[10px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' }}
      >
        {code}
      </pre>
    </div>
  );
}