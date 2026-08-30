import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * MobileBottomActionBar — slides up from the bottom when items are selected
 * on mobile list pages. Shows the selection count and action buttons.
 * Hidden on desktop (sm+) where inline toolbars are preferred.
 *
 * Usage:
 *   <MobileBottomActionBar
 *     selectedCount={selectedIds.length}
 *     actions={[
 *       { label: 'Delete', icon: Trash2, onClick: handleDelete, variant: 'danger' },
 *       { label: 'Export', icon: Download, onClick: handleExport },
 *     ]}
 *     onClear={() => setSelectedIds([])}
 *   />
 */
export default function MobileBottomActionBar({ selectedCount, actions = [], onClear }) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-40 sm:hidden safe-area-bottom"
        >
          <div className="bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              {/* Selection count */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2E5A1A] text-white text-xs font-bold tabular-nums">
                  {selectedCount}
                </span>
                <span className="text-xs font-semibold text-slate-600">selected</span>
              </div>

              {/* Actions */}
              <div className="flex-1 flex items-center justify-end gap-1.5 overflow-x-auto no-scrollbar">
                {actions.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={i}
                      onClick={a.onClick}
                      disabled={a.disabled}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 flex-shrink-0 disabled:opacity-50 ${
                        a.variant === 'danger'
                          ? 'bg-rose-50 text-rose-600 active:bg-rose-100'
                          : a.variant === 'primary'
                          ? 'bg-[#2E5A1A] text-white active:bg-[#1c4a12]'
                          : 'bg-slate-100 text-slate-700 active:bg-slate-200'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {a.label}
                    </button>
                  );
                })}
              </div>

              {/* Clear button */}
              {onClear && (
                <button
                  onClick={onClear}
                  className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 active:scale-95"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}