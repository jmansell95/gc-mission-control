import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Eye, EyeOff, Check } from 'lucide-react';
import {
  WIDGET_REGISTRY, WIDGET_CATEGORIES,
} from '@/components/dashboard/registry';

/**
 * WidgetLibraryDrawer — left-side slide-in drawer for the widget picker.
 *
 * Shows all available widgets grouped by category, with search and
 * toggle switches. Mirrors the HubQuickLinks pattern.
 *
 * Props:
 *   open — whether the drawer is visible
 *   onClose — callback to close the drawer
 *   activeWidgetIds — array of widget IDs currently on the dashboard
 *   hiddenWidgetIds — array of widget IDs that are hidden
 *   onAddWidget(id) — add a widget to the dashboard
 *   onToggleWidget(id) — toggle a widget's visibility
 *   customKpiTiles — array of custom KPI tile definitions from the division config
 */
export default function WidgetLibraryDrawer({
  open,
  onClose,
  activeWidgetIds,
  hiddenWidgetIds,
  onAddWidget,
  onToggleWidget,
  customKpiTiles = [],
}) {
  const [search, setSearch] = useState('');

  const activeSet = useMemo(() => new Set(activeWidgetIds), [activeWidgetIds]);
  const hiddenSet = useMemo(() => new Set(hiddenWidgetIds), [hiddenWidgetIds]);

  // Build the full widget list including custom KPI tiles
  const allWidgets = useMemo(() => {
    const standard = Object.entries(WIDGET_REGISTRY).map(([id, config]) => ({
      id,
      ...config,
      isCustom: false,
    }));
    const custom = customKpiTiles.map(t => ({
      id: t.id,
      title: t.label,
      icon: null, // will be resolved by the renderer
      category: 'custom',
      description: `Custom KPI: ${t.aggregation} of ${t.entity_name}`,
      isCustom: true,
    }));
    return [...standard, ...custom];
  }, [customKpiTiles]);

  const filtered = useMemo(() => {
    if (!search) return allWidgets;
    const q = search.toLowerCase();
    return allWidgets.filter(w =>
      w.title?.toLowerCase().includes(q) ||
      w.description?.toLowerCase().includes(q)
    );
  }, [allWidgets, search]);

  // Add a "Custom" category if there are custom tiles
  const categories = useMemo(() => {
    const cats = [...WIDGET_CATEGORIES];
    if (customKpiTiles.length > 0) {
      cats = [{ key: 'custom', label: 'Custom KPIs', icon: Plus }, ...cats];
    }
    return cats;
  }, [customKpiTiles.length]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white border-r border-slate-200 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Widget Library</h3>
                  <p className="text-xs text-slate-400">Toggle widgets on/off</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search widgets…"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Widget list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {categories.map(cat => {
                const catWidgets = filtered.filter(w => w.category === cat.key);
                if (catWidgets.length === 0) return null;
                const CatIcon = cat.icon;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                        <CatIcon className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.label}</h4>
                    </div>
                    <div className="space-y-1.5">
                      {catWidgets.map(w => {
                        const isActive = activeSet.has(w.id);
                        const isHidden = hiddenSet.has(w.id);
                        const Icon = w.icon;
                        return (
                          <div
                            key={w.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                              isActive && !isHidden
                                ? 'border-primary/30 bg-primary/5'
                                : isActive && isHidden
                                  ? 'border-slate-200 bg-slate-50'
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                            onClick={() => {
                              if (!isActive) onAddWidget(w.id);
                              else onToggleWidget(w.id);
                            }}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isActive && !isHidden ? 'bg-primary/10' : 'bg-slate-100'
                            }`}>
                              {Icon ? (
                                <Icon className={`w-4 h-4 ${isActive && !isHidden ? 'text-primary' : 'text-slate-500'}`} />
                              ) : (
                                <Plus className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${isActive && !isHidden ? 'text-slate-900' : 'text-slate-600'}`}>
                                {w.title}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{w.description}</p>
                            </div>
                            {/* Toggle indicator */}
                            <div className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${
                              isActive && !isHidden
                                ? 'bg-primary text-white'
                                : isHidden
                                  ? 'bg-slate-200 text-slate-400'
                                  : 'border-2 border-slate-200'
                            }`}>
                              {isActive && !isHidden && <Check className="w-3.5 h-3.5" />}
                              {isHidden && <EyeOff className="w-3 h-3" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm font-semibold text-slate-500">No widgets found</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}