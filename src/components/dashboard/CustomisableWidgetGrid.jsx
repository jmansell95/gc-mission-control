import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw, Cloud,
  Maximize2, Minimize2, Square, Plus, X, ArrowUp, ArrowDown,
  LayoutGrid, Move, Monitor,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  WIDGET_REGISTRY, WIDGET_CATEGORIES,
} from '@/components/dashboard/registry';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import WidgetLibraryDrawer from '@/components/dashboard/WidgetLibraryDrawer';
import CustomKPITile from '@/components/dashboard/CustomKPITile';

// Size → colspan for simple mode (4-col grid)
const SIMPLE_SIZE_COLSPAN = { sm: 'lg:col-span-1', md: 'lg:col-span-2', lg: 'lg:col-span-3', xl: 'lg:col-span-4' };
const SIMPLE_SIZE_LABEL = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const SIMPLE_SIZE_NEXT = { sm: 'md', md: 'lg', lg: 'xl', xl: 'sm' };
const SIMPLE_SIZE_ICON = { sm: Minimize2, md: Square, lg: Maximize2, xl: Maximize2 };

// Size → colspan for advanced mode (12-col grid)
const ADV_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * CustomisableWidgetGrid — the fully customisable dashboard widget board.
 *
 * Two modes:
 *   'simple' — structured add/remove/reorder with up/down arrows, fixed 4-col grid
 *   'advanced' — free-form drag-and-drop on a 12-col grid with resize handles
 *
 * Uses the useDashboardLayout hook to persist the layout per user + division.
 * Supports custom KPI tiles from the division's dashboard_config.
 */
export default function CustomisableWidgetGrid({ renderWidget, canShowWidget }) {
  const [customise, setCustomise] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load staff profile
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  // Load division dashboard config (for custom KPI tiles + enabled widgets + role defaults)
  const { data: divisionConfig } = useQuery({
    queryKey: ['division-dashboard-config', profile?.division_id],
    queryFn: async () => {
      if (!profile?.division_id) return null;
      const divisions = await base44.entities.Division.filter({ id: profile.division_id });
      return divisions[0]?.dashboard_config || null;
    },
    enabled: !!profile?.division_id,
    staleTime: 60 * 1000,
  });

  const customKpiTiles = divisionConfig?.custom_kpi_tiles || [];
  const enabledWidgets = divisionConfig?.enabled_widgets || [];
  const roleDefault = divisionConfig?.role_defaults?.[profile?.system_role] ||
                       divisionConfig?.role_defaults?.['office'] ||
                       divisionConfig?.role_defaults?.[profile?.role] || null;

  const {
    widgets, editMode, saving,
    setWidgets, setEditMode, resetLayout,
  } = useDashboardLayout({
    staffId: profile?.id,
    divisionId: profile?.division_id,
    roleDefault,
  });

  // Filter widgets by division's enabled list
  const canShow = (id) => {
    if (canShowWidget && !canShowWidget(id)) return false;
    if (enabledWidgets.length > 0 && !enabledWidgets.includes(id) && !id.startsWith('custom-kpi-')) return false;
    return true;
  };

  // Get the list of visible widgets (sorted by order for simple mode)
  const visibleWidgets = useMemo(() => {
    if (!widgets) return [];
    return widgets
      .filter(w => w.visible && canShow(w.id))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [widgets, enabledWidgets]);

  // Get all active widgets (visible + hidden) for the drawer
  const allActiveIds = useMemo(() => (widgets || []).map(w => w.id), [widgets]);
  const hiddenIds = useMemo(() => (widgets || []).filter(w => !w.visible).map(w => w.id), [widgets]);

  // --- Widget operations ---
  const addWidget = (id) => {
    setWidgets(prev => {
      if (!prev) return [{ id, visible: true, order: 0, position_x: 0, position_y: 0, size_w: 4, size_h: 1 }];
      if (prev.find(w => w.id === id)) {
        return prev.map(w => w.id === id ? { ...w, visible: true } : w);
      }
      const maxOrder = Math.max(0, ...prev.map(w => w.order || 0));
      return [...prev, { id, visible: true, order: maxOrder + 1, position_x: 0, position_y: maxOrder + 1, size_w: 4, size_h: 1 }];
    });
  };

  const toggleWidget = (id) => {
    setWidgets(prev => prev?.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const removeWidget = (id) => {
    setWidgets(prev => prev?.filter(w => w.id !== id));
  };

  const moveWidget = (id, direction) => {
    setWidgets(prev => {
      if (!prev) return prev;
      const sorted = [...prev].sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = sorted.findIndex(w => w.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const aOrder = a.order || idx;
      const bOrder = b.order || swapIdx;
      return prev.map(w => {
        if (w.id === a.id) return { ...w, order: bOrder };
        if (w.id === b.id) return { ...w, order: aOrder };
        return w;
      });
    });
  };

  const cycleSize = (id) => {
    setWidgets(prev => prev?.map(w => {
      if (w.id !== id) return w;
      if (editMode === 'simple') {
        const current = w.size_w <= 1 ? 'sm' : w.size_w <= 2 ? 'md' : w.size_w <= 3 ? 'lg' : 'xl';
        const next = SIMPLE_SIZE_NEXT[current];
        const nextW = next === 'sm' ? 1 : next === 'md' ? 2 : next === 'lg' ? 3 : 4;
        return { ...w, size_w: nextW };
      } else {
        const nextW = ((w.size_w || 4) % 12) + 1;
        return { ...w, size_w: nextW };
      }
    }));
  };

  // Drag-and-drop reorder (advanced mode)
  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...visibleWidgets];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const visibleSet = new Set(visibleWidgets.map(w => w.id));
    let vi = 0;
    setWidgets(prev => prev?.map(w => {
      if (!visibleSet.has(w.id)) return w;
      const newOrder = reordered[vi].order;
      vi++;
      return { ...w, order: vi };
    }));
  };

  // --- Render ---
  if (!widgets) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Render a widget's content
  const renderWidgetContent = (widgetId) => {
    // Custom KPI tile
    if (widgetId.startsWith('custom-kpi-')) {
      const tile = customKpiTiles.find(t => t.id === widgetId);
      if (tile) return <CustomKPITile tile={tile} />;
    }
    return renderWidget ? renderWidget(widgetId) : null;
  };

  // Get the size label for a widget
  const getSizeLabel = (w) => {
    if (editMode === 'simple') {
      const s = w.size_w <= 1 ? 'sm' : w.size_w <= 2 ? 'md' : w.size_w <= 3 ? 'lg' : 'xl';
      return SIMPLE_SIZE_LABEL[s];
    }
    return `${w.size_w || 4}`;
  };

  const getColspanClass = (w) => {
    if (editMode === 'simple') {
      const s = w.size_w <= 1 ? 'sm' : w.size_w <= 2 ? 'md' : w.size_w <= 3 ? 'lg' : 'xl';
      return SIMPLE_SIZE_COLSPAN[s];
    }
    return `lg:col-span-${w.size_w || 4}`;
  };

  return (
    <div className="mb-4">
      {/* Customise bar */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Cloud className="w-3 h-3 animate-pulse" /> Saving…
              </span>
            ) : customise ? (
              <span className="text-[11px] text-slate-400 font-medium">
                {editMode === 'simple' ? 'Use arrows to reorder · click size to resize' : 'Drag to reorder · click size to resize'}
              </span>
            ) : (
              <span />
            )}
          </div>
          {customise && (
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setEditMode('simple')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    editMode === 'simple' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Simple
                </button>
                <button
                  onClick={() => setEditMode('advanced')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    editMode === 'advanced' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" /> Advanced
                </button>
              </div>
              <button
                onClick={() => { setDrawerOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Widget
              </button>
              <button
                onClick={resetLayout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setCustomise(!customise)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            customise ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-primary/30'
          }`}
        >
          {customise ? <><Check className="w-4 h-4" /> Done Customising</> : <><Settings2 className="w-4 h-4" /> Customise Dashboard</>}
        </button>
      </div>

      {/* Visibility toggles — customise mode only */}
      {customise && visibleWidgets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {visibleWidgets.map(w => {
            const config = WIDGET_REGISTRY[w.id];
            const title = config?.title || customKpiTiles.find(t => t.id === w.id)?.label || w.id;
            return (
              <button
                key={w.id}
                onClick={() => toggleWidget(w.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                {title}
              </button>
            );
          })}
        </div>
      )}

      {/* Widget Library Drawer */}
      <WidgetLibraryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeWidgetIds={allActiveIds}
        hiddenWidgetIds={hiddenIds}
        onAddWidget={addWidget}
        onToggleWidget={toggleWidget}
        customKpiTiles={customKpiTiles}
      />

      {/* Widget grid */}
      {editMode === 'simple' ? (
        // ── Simple mode: up/down arrows, fixed 4-col grid ──
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {visibleWidgets.map((w) => {
            const content = renderWidgetContent(w.id);
            if (!content) return null;
            const config = WIDGET_REGISTRY[w.id];
            const colspanClass = getColspanClass(w);
            return (
              <div key={w.id} className={`${colspanClass} relative ${customise ? 'ring-2 ring-primary/30 rounded-2xl pt-8' : ''}`}>
                {customise && (
                  <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
                    <button
                      onClick={() => moveWidget(w.id, 'up')}
                      className="bg-white text-primary px-2 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-primary/20 hover:bg-primary/5 transition touch-manipulation"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(w.id, 'down')}
                      className="bg-white text-primary px-2 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-primary/20 hover:bg-primary/5 transition touch-manipulation"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => cycleSize(w.id)}
                      className="bg-white text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-primary/20 hover:bg-primary/5 transition touch-manipulation"
                      title="Size"
                    >
                      {getSizeLabel(w)}
                    </button>
                    <button
                      onClick={() => removeWidget(w.id)}
                      className="bg-white text-rose-500 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-rose-200 hover:bg-rose-50 transition touch-manipulation"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        // ── Advanced mode: drag-and-drop, 12-col grid ──
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="widget-grid-advanced">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {visibleWidgets.map((w, index) => {
                  const content = renderWidgetContent(w.id);
                  if (!content) return null;
                  const colspanClass = getColspanClass(w);
                  return (
                    <Draggable key={w.id} draggableId={w.id} index={index} isDragDisabled={!customise}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`${colspanClass} relative ${customise ? 'ring-2 ring-primary/30 rounded-2xl pt-8' : ''} ${snapshot.isDragging ? 'z-50 shadow-2xl opacity-90' : ''}`}
                        >
                          {customise && (
                            <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
                              <div {...prov.dragHandleProps}
                                className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-grab active:cursor-grabbing touch-manipulation">
                                <GripVertical className="w-3.5 h-3.5" /> Drag
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); cycleSize(w.id); }}
                                className="bg-white text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-primary/20 hover:bg-primary/5 transition touch-manipulation"
                                title="Size"
                              >
                                {getSizeLabel(w)}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeWidget(w.id); }}
                                className="bg-white text-rose-500 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg ring-1 ring-rose-200 hover:bg-rose-50 transition touch-manipulation"
                                title="Remove"
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
      )}

      {/* Empty state */}
      {visibleWidgets.length === 0 && !customise && (
        <div className="hub-glass rounded-2xl p-12 text-center">
          <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Your dashboard is empty</p>
          <p className="text-xs text-slate-400 mt-1">Click "Customise Dashboard" to add widgets</p>
        </div>
      )}
    </div>
  );
}