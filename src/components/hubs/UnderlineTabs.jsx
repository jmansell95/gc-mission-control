import React, { useId, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * UnderlineTabs — the canonical tab bar for the entire site.
 *
 * Clean Inter text labels with a thick animated gradient underline that
 * slides between tabs using framer-motion shared layout. Inactive tabs are
 * muted slate-500 that darkens to slate-900 on hover. The bar has a subtle
 * bottom hairline border so the underline reads as part of the bar.
 *
 * variant: 'main' (hub-level tabs, larger) | 'sub' (sub-tabs, compact)
 * tabs: [{ id, label, icon?, badge?, count? }]
 */
export default function UnderlineTabs({ tabs, activeId, onChange, variant = 'main', className = '', sticky = false }) {
  const layoutId = useId();
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const offset = tab.offsetLeft - container.offsetLeft - (container.clientWidth - tab.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [activeId]);

  if (!tabs || tabs.length === 0) return null;

  const isMain = variant === 'main';
  const textClass = isMain ? 'text-ui-subheading' : 'text-ui-body';
  const padClass = isMain ? 'px-4 py-2.5' : 'px-3.5 py-2';
  const iconSize = isMain ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className={`${sticky ? 'sticky top-1 lg:static z-20' : ''} ${className}`}>
      <div className="relative border-b border-slate-200/80">
        <div
          ref={scrollRef}
          className="flex gap-0.5 overflow-x-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {tabs.map(t => {
            const Icon = t.icon;
            const active = activeId === t.id;
            return (
              <button
                key={t.id}
                ref={active ? activeRef : null}
                onClick={() => onChange(t.id)}
                type="button"
                className={`group relative inline-flex items-center gap-1.5 ${padClass} ${textClass} font-semibold whitespace-nowrap flex-shrink-0 transition-colors duration-200 ${
                  active
                    ? 'text-[#2E5A1A]'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {Icon && <Icon className={`${iconSize} transition-colors ${active ? 'text-[#2E5A1A]' : 'text-slate-400 group-hover:text-slate-600'}`} />}
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-ui-micro font-bold ${active ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]' : 'bg-rose-100 text-rose-600'}`}>{t.badge}</span>
                )}
                {t.count != null && (
                  <span className={`ml-0.5 text-ui-caption font-normal ${active ? 'text-[#2E5A1A]/60' : 'text-slate-400'}`}>{t.count}</span>
                )}
                {active && (
                  <motion.div
                    layoutId={`underline-${layoutId}`}
                    className="absolute left-1.5 right-1.5 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}