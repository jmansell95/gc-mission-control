import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw, Loader2,
  Maximize2, Minimize2, Square, Cloud, Plus, X, Search,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WIDGET_REGISTRY, DEFAULT_WIDGETS, DEFAULT_HIDDEN, WIDGET_CATEGORIES, GLOBAL_ONLY_WIDGETS,
} from '@/components/dashboard/registry';

const ORDER_KEY = 'dashboard-widget-order-v4';
const HIDDEN_KEY = 'dashboard-widget-hidden-v4';
const SIZES_KEY = 'dashboard-widget-sizes-v4';

// Size → Tailwind colspan on the 4-col grid
const SIZE_COLSPAN = { sm: 'lg:col-span-1', md: 'lg:col-span-2', lg: 'lg:col-span-3', xl: 'lg:col-span-4' };
const SIZE_ICON = { sm: Minimize2, md: Square, lg: Maximize2, xl: Maximize2 };
const SIZE_LABEL = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const SIZE_NEXT = { sm: 'md', md: 'lg', lg: 'xl', xl: 'sm' };

function loadOrderCache() {
  try {
    const saved = localStorage.getItem(ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const valid = parsed.filter(id => WIDGET_REGISTRY[id]);
      const newWidgets = DEFAULT_WIDGETS.filter(id => !valid.includes(id));
      return [...valid, ...newWidgets];
    }
  } catch {}
  return [...DEFAULT_WIDGETS];
}
function loadHiddenCache() {
  try { const s = localStorage.getItem(HIDDEN_KEY); if (s) return JSON.parse(s); } catch {}
  return [...DEFAULT_HIDDEN];
}
function loadSizesCache() {
  try { const s = localStorage.getItem(SIZES_KEY); if (s) return JSON.parse(s); } catch {}
  return {};
}

export default function CustomisableWidgetGrid({ renderWidget, canShowWidget }) {
  const [customise, setCustomise] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [order, setOrder] = useState(loadOrderCache);
  const [hidden, setHidden] = useState(loadHiddenCache);
  const [sizes, setSizes] = useState(loadSizesCache);
  const [layoutId, setLayoutId] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const hasAppliedServer = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const { data: savedLayout } = useQuery({
    queryKey: ['my-dashboard-layout', profile?.id],
    queryFn: async () => {
      const layouts = await base44.entities.DashboardLayout.filter({ staff_id: profile.id });
      return layouts[0] || null;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (!savedLayout || hasAppliedServer.current) return;
    hasAppliedServer.current = true;
    if (savedLayout.widget_order) {
      const valid = savedLayout.widget_order.filter(id => WIDGET_REGISTRY[id]);
      const newWidgets = DEFAULT_WIDGETS.filter(id => !valid.includes(id));
      setOrder([...valid, ...newWidgets]);
    }
    if (savedLayout.hidden_widgets) setHidden(savedLayout.hidden_widgets);
    if (savedLayout.widget_sizes) setSizes(savedLayout.widget_sizes || {});
    if (savedLayout.id) setLayoutId(savedLayout.id);
  }, [savedLayout]);

  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }, [order]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); }, [hidden]);
  useEffect(() => { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); }, [sizes]);

  const saveToEntity = useCallback((newOrder, newHidden, newSizes) => {
    if (!profile?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = { staff_id: profile.id, widget_order: newOrder, hidden_widgets: newHidden, widget_sizes: newSizes };
        if (layoutId) await base44.entities.DashboardLayout.update(layoutId, payload);
        else { const created = await base44.entities.DashboardLayout.create(payload); if (created?.id) setLayoutId(created.id); }
      } catch {}
      setSaving(false);
    }, 800);
  }, [profile?.id, layoutId]);

  useEffect(() => { saveToEntity(order, hidden, sizes); }, [order, hidden, sizes, saveToEntity]);

  const canShow = useCallback((id) => {
    if (canShowWidget && !canShowWidget(id)) return false;
    return true;
  }, [canShowWidget]);

  const availableWidgets = order.filter(canShow);
  const visibleWidgets = availableWidgets.filter(id => !hidden.includes(id));

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...visibleWidgets];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const visibleSet = new Set(visibleWidgets);
    let vi = 0;
    const newOrder = order.map(id => (visibleSet.has(id) ? reordered[vi++] : id));
    setOrder(newOrder);
  };

  const toggleHidden = (id) => setHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const cycleSize = (id) => setSizes(prev => ({ ...prev, [id]: SIZE_NEXT[prev[id] || 'md'] }));
  const resetLayout = () => { setOrder([...DEFAULT_WIDGETS]); setHidden([...DEFAULT_HIDDEN]); setSizes({}); };

  // Add a widget from the picker
  const addWidget = (id) => {
    if (order.includes(id)) {
      // If hidden, unhide it
      if (hidden.includes(id)) setHidden(prev => prev.filter(x => x !== id));
      return;
    }
    setOrder(prev => [...prev, id]);
    setHidden(prev => prev.filter(x => x !== id)); // ensure visible
  };

  // Remove a widget entirely (not just hide)
  const removeWidget = (id) => {
    setOrder(prev => prev.filter(x => x !== id));
    setHidden(prev => prev.filter(x => x !== id));
    setSizes(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Picker: widgets not yet in the dashboard
  const pickerWidgets = Object.keys(WIDGET_REGISTRY)
    .filter(id => WIDGET_REGISTRY[id])
    .filter(id => !order.includes(id) || hidden.includes(id))
    .filter(id => {
      if (!pickerSearch) return true;
      const config = WIDGET_REGISTRY[id];
      return config.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
             config.description?.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div className="mb-4">
      {/* Customise bar */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Cloud className="w-3 h-3 animate-pulse" /> Saving…
            </span>
          ) : customise ? (
            <span className="text-[11px] text-slate-400 font-medium">
              Drag to reorder · click size to resize · click eye to toggle
            </span>
          ) : <span />}
          {customise && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowPicker(true); setPickerSearch(''); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2E5A1A] bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Widget
              </button>
              <button onClick={resetLayout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setCustomise(!customise)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${customise ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-[#2E5A1A]/30'}`}>
          {customise ? <><Check className="w-4 h-4" /> Done Customising</> : <><Settings2 className="w-4 h-4" /> Customise Dashboard</>}
        </button>
      </div>

      {/* Visibility toggles — customise mode only */}
      {customise && availableWidgets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {availableWidgets.map(id => {
            const config = WIDGET_REGISTRY[id];
            if (!config) return null;
            const isHidden = hidden.includes(id);
            return (
              <button key={id} onClick={() => toggleHidden(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${isHidden ? 'bg-slate-100 text-slate-400 line-through' : 'bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/20'}`}>
                {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {config.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Widget Picker Panel */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-pop-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Widgets</h3>
                  <p className="text-xs text-slate-400">Click to add to your dashboard</p>
                </div>
              </div>
              <button onClick={() => setShowPicker(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search widgets…"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
                />
              </div>
            </div>

            {/* Widget list grouped by category */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {pickerWidgets.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">All widgets are on your dashboard!</p>
                </div>
              ) : (
                WIDGET_CATEGORIES.map(cat => {
                  const catWidgets = pickerWidgets.filter(id => WIDGET_REGISTRY[id]?.category === cat.key);
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {catWidgets.map(id => {
                          const config = WIDGET_REGISTRY[id];
                          const Icon = config.icon;
                          const isAlreadyHidden = hidden.includes(id);
                          return (
                            <button
                              key={id}
                              onClick={() => addWidget(id)}
                              className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/5 transition text-left group"
                            >
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center flex-shrink-0 group-hover:from-[#2E5A1A]/10 group-hover:to-[#8DC63F]/10 transition">
                                <Icon className="w-4 h-4 text-slate-500 group-hover:text-[#2E5A1A] transition" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-slate-800">{config.title}</p>
                                  {isAlreadyHidden && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">HIDDEN</span>}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 leading-snug">{config.description}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] flex-shrink-0 mt-1 transition" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flat widget grid */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="widget-grid">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {visibleWidgets.map((widgetId, index) => {
                const content = renderWidget(widgetId);
                if (!content) return null;
                const config = WIDGET_REGISTRY[widgetId];
                const userSize = sizes[widgetId] || (config?.fullWidth ? 'xl' : 'md');
                const colspanClass = SIZE_COLSPAN[userSize] || 'lg:col-span-2';
                const SizeIcon = SIZE_ICON[userSize] || Square;
                return (
                  <Draggable key={widgetId} draggableId={widgetId} index={index} isDragDisabled={!customise}>
                    {(prov, snapshot) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`${colspanClass} relative ${customise ? 'ring-2 ring-[#2E5A1A]/30 rounded-2xl pt-8' : ''} ${snapshot.isDragging ? 'z-50 shadow-2xl opacity-90' : ''}`}
                      >
                        {customise && (
                          <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
                            <div {...prov.dragHandleProps}
                              className="bg-[#2E5A1A] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-grab active:cursor-grabbing touch-manipulation">
                              <GripVertical className="w-3.5 h-3.5" /> Drag
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); cycleSize(widgetId); }}
                              className="bg-white text-[#2E5A1A] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 transition z-30 relative touch-manipulation"
                              title={`Size: ${SIZE_LABEL[userSize]} (click to change)`}
                            >
                              <SizeIcon className="w-3.5 h-3.5" /> {SIZE_LABEL[userSize]}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeWidget(widgetId); }}
                              className="bg-white text-rose-500 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-rose-200 hover:bg-rose-50 transition z-30 relative touch-manipulation"
                              title="Remove from dashboard"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {content}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}