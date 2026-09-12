import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Check, Loader2, ChevronDown, ChevronUp, Wrench,
  Sparkles, AlertCircle, Mic,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * Shared agent chat panel — modern, conversational UI with dual layouts.
 *
 * MOBILE/TABLET (< lg): Full-screen immersive experience. Slides up from
 *   bottom, takes 100% of viewport height. Optimised for on-site use.
 *
 * DESKTOP (>= lg): Right-side drawer panel. Slides in from the right,
 *   full height, 480px wide. Sits alongside the dashboard content.
 *
 * Features: glassmorphic gradient header, AI avatar with pulse ring,
 * animated message bubbles, bouncing typing indicator, visual suggestion
 * cards, styled markdown rendering, and tool-call displays.
 */
export default function AgentChatPanel({
  open, onClose, messages, input, setInput, onSend, loading, sending, scrollRef,
  icon: Icon, title, subtitle, placeholder, suggestions = [],
  brandClass = 'bg-primary', brandRing = 'focus:ring-primary/40',
  headerGradient = 'hero-vibrant',
}) {
  // Detect viewport for animation direction
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end lg:items-stretch justify-end"
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={isDesktop ? { x: '100%', opacity: 0 } : { y: '100%', opacity: 0, scale: 0.98 }}
            animate={isDesktop ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={isDesktop ? { x: '100%', opacity: 0 } : { y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative bg-slate-50 rounded-t-3xl lg:rounded-none lg:rounded-l-3xl shadow-2xl w-full lg:max-w-[480px] h-[100dvh] lg:h-screen flex flex-col overflow-hidden ring-1 ring-black/5"
          >
            {/* Header — glassmorphic gradient */}
            <div className={`relative flex items-center justify-between px-4 py-3.5 border-b border-white/10 ${headerGradient} overflow-hidden flex-shrink-0`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-60" style={{ animationDuration: '2.5s' }} />
                  <div className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center ring-1 ring-white/25 backdrop-blur-sm">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate tracking-tight">{title}</p>
                  <p className="text-white/70 text-[11px] truncate">{subtitle}</p>
                </div>
              </div>
              <button onClick={onClose} className="relative p-2 text-white/80 hover:bg-white/15 hover:text-white rounded-xl transition flex-shrink-0 active:scale-90">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 bg-gradient-to-b from-slate-50 to-slate-100/50">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary/60" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-[#2E5A1A] animate-spin" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">Connecting…</p>
                </div>
              )}
              {messages.length === 0 && !loading && (
                <EmptyState Icon={Icon} suggestions={suggestions} onSuggestion={(s) => setInput(s)} />
              )}
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} Icon={Icon} isLast={i === messages.length - 1} />
              ))}
              {sending && (
                <TypingBubble Icon={Icon} />
              )}
            </div>

            {/* Input */}
            <form onSubmit={(e) => onSend(e)} className="p-3 border-t border-slate-200 bg-white/90 backdrop-blur-sm flex items-end gap-2 safe-area-bottom flex-shrink-0">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder}
                  className={`w-full pl-4 pr-4 py-3 bg-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition ${brandRing}`}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={`p-3 ${brandClass} text-white rounded-2xl hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0 active:scale-90 shadow-sm`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ Icon, suggestions, onSuggestion }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-2">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-lg">
          <Icon className="w-8 h-8 text-white" />
        </div>
      </div>
      <p className="text-slate-800 font-bold text-base mb-1">How can I help?</p>
      <p className="text-slate-400 text-xs mb-5 max-w-xs">
        {suggestions.length > 0 ? 'Tap a suggestion below or ask me anything.' : 'Ask me a question to get started.'}
      </p>
      {suggestions.length > 0 && (
        <div className="w-full space-y-2 text-left">
          {suggestions.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => onSuggestion(s)}
              className="w-full flex items-center gap-2.5 text-left text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-3 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm transition group"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition flex-shrink-0" />
              <span className="leading-snug">{s}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, Icon, isLast }) {
  const isUser = message.role === 'user';
  const isPending = ['pending', 'running', 'in_progress'].includes(message.status);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#3a6b22] text-white rounded-2xl rounded-br-md shadow-sm text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex justify-start gap-2.5"
    >
      {/* AI avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className="px-4 py-3 bg-white border border-slate-200/80 text-slate-700 rounded-2xl rounded-tl-md shadow-sm">
          {message.content ? (
            <div className="prose prose-sm max-w-none
              prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-strong:text-slate-800 prose-strong:bg-primary/8 prose-strong:px-1 prose-strong:py-0.5 prose-strong:rounded
              prose-table:text-xs prose-table:border-collapse prose-table:w-full
              prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-2.5 prose-th:py-1.5 prose-th:font-semibold prose-th:text-slate-600
              prose-td:border prose-td:border-slate-200 prose-td:px-2.5 prose-td:py-1.5
              prose-li:text-slate-600 prose-li:my-0.5
              prose-a:text-primary prose-a:font-medium
              prose-code:text-primary prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-blockquote:border-l-[#2E5A1A] prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg
              prose-p:my-1.5 prose-p:leading-relaxed
            ">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-2 text-slate-400 py-1">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-medium">Thinking…</span>
            </div>
          ) : null}
          {message.tool_calls?.map((tc, i) => (
            <ToolCallDisplay key={i} toolCall={tc} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TypingBubble({ Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start gap-2.5"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="px-4 py-3 bg-white border border-slate-200/80 rounded-2xl rounded-tl-md shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </motion.div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isFailed = ['failed', 'error'].includes(status);
  const isActive = ['pending', 'running', 'in_progress'].includes(status);
  const proj = toolCall.display_projection || {};
  const label = proj.label || toolCall.name || 'Tool call';
  const activeLabel = proj.active_label || 'Querying…';
  const errorLabel = proj.error_label || 'Failed';
  const hideDetails = proj.hide_details && proj.details_redacted;
  const statusText = isActive ? activeLabel : isFailed ? errorLabel : label;

  let resultSummary = null;
  if (toolCall.result && !hideDetails) {
    try {
      const parsed = typeof toolCall.result === 'string' ? JSON.parse(toolCall.result) : toolCall.result;
      if (Array.isArray(parsed)) {
        resultSummary = `${parsed.length} record${parsed.length !== 1 ? 's' : ''}`;
      } else if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        resultSummary = keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '');
      }
    } catch { resultSummary = null; }
  }

  return (
    <div className="mt-2.5 text-xs border-t border-slate-100 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition"
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        ) : isFailed ? (
          <AlertCircle className="w-3 h-3 text-red-500" />
        ) : (
          <Check className="w-3 h-3 text-emerald-600" />
        )}
        <span className="font-medium">{statusText}</span>
        {resultSummary && !isActive && (
          <span className="text-slate-400">· {resultSummary}</span>
        )}
        {!hideDetails && (toolCall.arguments_string || toolCall.result) && (
          expanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />
        )}
      </button>
      {!hideDetails && expanded && (
        <div className="mt-1.5 space-y-1.5">
          {toolCall.arguments_string && (
            <div className="p-2 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-400 mb-1 flex items-center gap-1"><Wrench className="w-2.5 h-2.5" /> Parameters</p>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-500 font-mono">
                {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div className="p-2 bg-emerald-50/50 rounded-lg">
              <p className="font-medium text-emerald-700 mb-1">Result</p>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-600 font-mono max-h-40 overflow-y-auto">
                {(() => {
                  try {
                    const r = typeof toolCall.result === 'string' ? JSON.parse(toolCall.result) : toolCall.result;
                    return JSON.stringify(r, null, 2);
                  } catch { return String(toolCall.result); }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}