import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw, Cloud,
  Maximize2, Minimize2, Square, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  SECTIONS, BLOCK_REGISTRY, DEFAULT_SECTION_LAYOUT,
  DEFAULT_HIDDEN_BLOCKS, DEFAULT_BLOCK_SIZES, ALL_BLOCK_IDS,
} from '@/components/dashboard/blockRegistry';
import SectionHeader from '@/components/dashboard/SectionHeader';

const LAYOUT_KEY = 'cc-section-layout-v1';
const HIDDEN_KEY = 'cc-hidden-blocks-v1';
const SIZES_KEY = 'cc-block-sizes-v1';
const COLLAPSE_KEY = 'cc-section-collapsed-v1';

const SIZE_COLSPAN = { sm: 'lg:col-span-1', md: 'lg:col-span-2', lg: 'lg:col-span-3', xl: 'lg:col-span-4' };
const SIZE_ICON = { sm: Minimize2, md: Square, lg: Maximize2, xl: Maximize2 };
const SIZE_LABEL = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const SIZE_NEXT = { sm: 'md', md: 'lg', lg: 'xl', xl: 'sm' };

// ── localStorage helpers ──
function loadJSON(key, fallback) {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch {}
  return fallback;
}

// Ensure every known block appears in exactly one section
function normalizeLayout(layout) {
  const result = { operations: [...(layout.operations || [])], financial: [...(layout.financial || [])], safety: [...(layout.safety || [])] };
  const placed = new Set([...result.operations, ...result.financial, ...result.safety]);
  for (const id of ALL_BLOCK_IDS) {
    if (!placed.has(id)) {
      const section = BLOCK_REGISTRY[id].section;
      result[section] = [...result[section], id];
    }
  }
  // Remove any unknown IDs
  for (const sec of Object.keys(result)) {
    result[sec] = result[sec].filter(id => BLOCK_REGISTRY[id]);
  }
  return result;
}

// Migrate old widget_order → section_layout
function migrateOldLayout(saved) {
  if (saved?.section_layout) return normalizeLayout(saved.section_layout);
  if (saved?.widget_order) {
    const layout = { operations: [], financial: [], safety: [] };
    for (const id of saved.widget_order) {
      const block = BLOCK_REGISTRY[id];
      if (block) layout[block.section].push(id);
    }
    return normalizeLayout(layout);
  }
  return { ...DEFAULT_SECTION_LAYOUT };
}

/**
 * CommandCentreGrid — the unified customisable dashboard grid.
 *
 * Renders three collapsible sections (Operations, Financial, Safety &
 * Compliance). Every block — stat tiles, rig widget, site snapshot,
 * mission control, insight widgets — is drag-and-drop reorderable,
 * resizable (S/M/L/XL), and hideable. The full layout persists to the
 * user's DashboardLayout entity and restores on next login.
 */
export default function CommandCentreGrid({ blockRenderers }) {
  const [customise, setCustomise] = useState(false);
  const [sectionLayout, setSectionLayout] = useState(() => normalizeLayout(loadJSON(LAYOUT_KEY, DEFAULT_SECTION_LAYOUT)));
  const [hidden, setHidden] = useState(() => loadJSON(HIDDEN_KEY, DEFAULT_HIDDEN_BLOCKS));
  const [sizes, setSizes] = useState(() => loadJSON(SIZES_KEY, DEFAULT_BLOCK_SIZES));
  const [collapsed, setCollapsed] = useState(() => loadJSON(COLLAPSE_KEY, {}));
  const [layoutId, setLayoutId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  const saveTimer = useRef(null);
  const hasAppliedServer = useRef(false);

  // Track mobile breakpoint — drag-and-drop is desktop/tablet only
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load the user's saved layout from the server
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
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
    setSectionLayout(normalizeLayout(migrateOldLayout(savedLayout)));
    if (savedLayout.hidden_blocks) setHidden(savedLayout.hidden_blocks);
    else if (savedLayout.hidden_widgets) setHidden(savedLayout.hidden_widgets);
    if (savedLayout.block_sizes) setSizes(savedLayout.block_sizes);
    else if (savedLayout.widget_sizes) setSizes(savedLayout.widget_sizes);
    if (savedLayout.id) setLayoutId(savedLayout.id);
  }, [savedLayout]);

  // Persist to localStorage immediately
  useEffect(() => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(sectionLayout)); }, [sectionLayout]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); }, [hidden]);
  useEffect(() => { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); }, [sizes]);
  useEffect(() => { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); }, [collapsed]);

  // Debounced save to DashboardLayout entity
  const saveToEntity = useCallback((newLayout, newHidden, newSizes) => {
    if (!profile?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = {
          staff_id: profile.id,
          section_layout: newLayout,
          hidden_blocks: newHidden,
          block_sizes: newSizes,
          // Keep old fields for backward compat
          widget_order: [...newLayout.operations, ...newLayout.financial, ...newLayout.safety],
          hidden_widgets: newHidden,
          widget_sizes: newSizes,
        };
        if (layoutId) await base44.entities.DashboardLayout.update(layoutId, payload);
        else { const created = await base44.entities.DashboardLayout.create(payload); if (created?.id) setLayoutId(created.id); }
      } catch {}
      setSaving(false);
    }, 800);
  }, [profile?.id, layoutId]);

  useEffect(() => { saveToEntity(sectionLayout, hidden, sizes); }, [sectionLayout, hidden, sizes, saveToEntity]);

  // ── DnD handlers ──
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const srcSec = source.droppableId;
    const dstSec = destination.droppableId;
    if (srcSec === dstSec) {
      const items = [...sectionLayout[srcSec]];
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setSectionLayout(prev => ({ ...prev, [srcSec]: items }));
    } else {
      const srcItems = [...sectionLayout[srcSec]];
      const dstItems = [...sectionLayout[dstSec]];
      const [moved] = srcItems.splice(source.index, 1);
      dstItems.splice(destination.index, 0, moved);
      setSectionLayout(prev => ({ ...prev, [srcSec]: srcItems, [dstSec]: dstItems }));
    }
  };

  const toggleHidden = (id) => setHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const cycleSize = (id) => setSizes(prev => ({ ...prev, [id]: SIZE_NEXT[prev[id] || BLOCK_REGISTRY[id]?.defaultSize || 'md'] }));
  const resetLayout = () => {
    setSectionLayout({ ...DEFAULT_SECTION_LAYOUT });
    setHidden([...DEFAULT_HIDDEN_BLOCKS]);
    setSizes({ ...DEFAULT_BLOCK_SIZES });
    setCollapsed({});
  };

  // All blocks across all sections (for the visibility toggle bar)
  const allBlocks = useMemo(() => [...sectionLayout.operations, ...sectionLayout.financial, ...sectionLayout.safety], [sectionLayout]);

  return (
    <div className="mb-4">
      {/* ── Customise bar ── */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Cloud className="w-3 h-3 animate-pulse" /> Saving…
            </span>
          ) : customise ? (
            <span className="text-[11px] text-slate-400 font-medium">
              {isMobile ? 'Tap eye to show/hide blocks' : 'Drag blocks between sections · click size to resize'}
            </span>
          ) : <span />}
          {customise && (
            <button onClick={resetLayout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
        <button onClick={() => setCustomise(!customise)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${customise ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-[#2E5A1A]/30'}`}>
          {customise ? <><Check className="w-4 h-4" /> Done Customising</> : <><Settings2 className="w-4 h-4" /> Customise Dashboard</>}
        </button>
      </div>

      {/* ── Visibility toggles (customise mode) ── */}
      {customise && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {allBlocks.map(id => {
            const config = BLOCK_REGISTRY[id];
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

      {/* ── Sections with DnD ── */}
      <DragDropContext onDragEnd={onDragEnd}>
        {SECTIONS.map(section => {
          const sectionBlocks = sectionLayout[section.id].filter(id => !hidden.includes(id));
          const isCollapsed = collapsed[section.id];

          return (
            <div key={section.id} className="mb-6">
              <SectionHeader
                title={section.title}
                icon={section.icon}
                accent={section.accent}
                collapsed={isCollapsed}
                onToggle={() => setCollapsed(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                visibleCount={sectionBlocks.length}
              />

              {!isCollapsed && (
                <Droppable droppableId={section.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`grid grid-cols-1 lg:grid-cols-4 gap-4 transition rounded-xl ${snapshot.isDraggingOver ? 'bg-[#2E5A1A]/5 border-2 border-dashed border-[#2E5A1A]/30 p-2' : ''}`}
                    >
                      {sectionBlocks.map((blockId, index) => {
                        const content = blockRenderers[blockId]?.();
                        if (!content) return null;
                        const config = BLOCK_REGISTRY[blockId];
                        const userSize = sizes[blockId] || config?.defaultSize || 'md';
                        const colspanClass = SIZE_COLSPAN[userSize] || 'lg:col-span-2';
                        const SizeIcon = SIZE_ICON[userSize] || Square;
                        const canDrag = customise && !isMobile;

                        return (
                          <Draggable key={blockId} draggableId={blockId} index={index} isDragDisabled={!canDrag}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={`${colspanClass} relative ${customise ? 'ring-2 ring-[#2E5A1A]/30 rounded-2xl pt-8' : ''} ${snap.isDragging ? 'z-50 shadow-2xl opacity-90' : ''}`}
                              >
                                {customise && (
                                  <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
                                    {canDrag && (
                                      <div {...prov.dragHandleProps}
                                        className="bg-[#2E5A1A] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-grab active:cursor-grabbing touch-manipulation">
                                        <GripVertical className="w-3.5 h-3.5" /> Drag
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); cycleSize(blockId); }}
                                      className="bg-white text-[#2E5A1A] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 transition z-30 relative touch-manipulation"
                                      title={`Size: ${SIZE_LABEL[userSize]} (click to change)`}
                                    >
                                      <SizeIcon className="w-3.5 h-3.5" /> {SIZE_LABEL[userSize]}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleHidden(blockId); }}
                                      className="bg-white text-rose-500 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-rose-200 hover:bg-rose-50 transition z-30 relative touch-manipulation"
                                      title="Hide block"
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
                      {sectionBlocks.length === 0 && customise && (
                        <div className="col-span-full text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                          Drag blocks here from another section
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
}