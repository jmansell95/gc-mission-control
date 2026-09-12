import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Building2, Layers, ArrowRight } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * OrgTreeNavigator — a collapsible BU → Stream tree for the admin sidebar.
 *
 * Shows the full enterprise org hierarchy (Business Units → Business Streams)
 * so enterprise admins can jump to any BU or stream with one click.
 *
 * - Clicking a BU navigates to the BU detail page (/enterprise/business-unit/:id)
 * - Clicking a Stream switches the active division and navigates to the admin dashboard
 * - Collapsible per-BU (expand/collapse chevron)
 * - Hidden when the sidebar is collapsed to icon-rail mode
 * - Only shown to enterprise admins (isEnterpriseAdmin)
 */
export default function OrgTreeNavigator() {
  const navigate = useNavigate();
  const { divisions, permittedDivisions, setActiveDivision, activeDivisionId, isEnterpriseAdmin } = useDivision();
  const [expandedBus, setExpandedBus] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('gc-orgtree-expanded') || '[]')); } catch { return new Set(); }
  });

  const hierarchy = useMemo(() => {
    const all = permittedDivisions.length > 0 ? permittedDivisions : divisions;
    const parentIds = new Set(all.filter(d => d.parent_division_id).map(d => d.parent_division_id));
    const bus = all.filter(d => !d.parent_division_id && parentIds.has(d.id));
    const standalone = all.filter(d => !d.parent_division_id && !parentIds.has(d.id));
    return { bus, standalone };
  }, [permittedDivisions, divisions]);

  const toggleBu = (buId) => {
    const next = new Set(expandedBus);
    if (next.has(buId)) next.delete(buId);
    else next.add(buId);
    setExpandedBus(next);
    try { localStorage.setItem('gc-orgtree-expanded', JSON.stringify([...next])); } catch {}
  };

  const enterStream = (stream) => {
    setActiveDivision(stream.id);
    navigate(stream.landing_page || '/admin', { state: { section: 'overview' } });
  };

  const enterBu = (bu) => navigate(`/enterprise/business-unit/${bu.id}`);

  if (!isEnterpriseAdmin) return null;

  const allDivs = permittedDivisions.length > 0 ? permittedDivisions : divisions;
  const hasHierarchy = hierarchy.bus.length > 0 || hierarchy.standalone.length > 0;
  if (!hasHierarchy) return null;

  return (
    <div className="px-2 pb-1.5">
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
          <Layers className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
          <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Org Tree</span>
        </div>
        <div className="py-1 max-h-[280px] overflow-y-auto no-scrollbar">
          {/* Business Units with children */}
          {hierarchy.bus.map(bu => {
            const streams = allDivs.filter(d => d.parent_division_id === bu.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const isExpanded = expandedBus.has(bu.id);
            return (
              <div key={bu.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleBu(bu.id)}
                    className="flex items-center gap-1 px-1.5 py-1.5 text-white/50 hover:text-white/80 transition flex-shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => enterBu(bu)}
                    className="flex-1 flex items-center gap-2 pr-2 py-1.5 text-ui-body font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition text-left min-w-0"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bu.color || '#2E5A1A' }} />
                    <span className="truncate">{bu.name}</span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-5 border-l border-white/10">
                    {streams.map(stream => {
                      const isActive = activeDivisionId === stream.id;
                      return (
                        <button
                          key={stream.id}
                          type="button"
                          onClick={() => enterStream(stream)}
                          className={`w-full flex items-center gap-2 pl-3 pr-2 py-1.5 text-ui-body font-medium rounded-lg transition text-left ${
                            isActive
                              ? 'bg-[#8DC63F]/15 text-[#8DC63F]'
                              : 'text-white/55 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: stream.color || bu.color || '#2E5A1A' }} />
                          <span className="truncate flex-1">{stream.name}</span>
                          {isActive && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone divisions (no parent BU) */}
          {hierarchy.standalone.length > 0 && (
            <div className={hierarchy.bus.length > 0 ? 'mt-1 pt-1 border-t border-white/10' : ''}>
              {hierarchy.bus.length > 0 && (
                <p className="px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-wider">Standalone</p>
              )}
              {hierarchy.standalone.map(stream => {
                const isActive = activeDivisionId === stream.id;
                return (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => enterStream(stream)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-ui-body font-semibold rounded-lg transition text-left ${
                      isActive
                        ? 'bg-[#8DC63F]/15 text-[#8DC63F]'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Building2 className="w-3 h-3 flex-shrink-0 opacity-50" />
                    <span className="truncate flex-1">{stream.name}</span>
                    {isActive && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}