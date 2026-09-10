import React, { useState } from 'react';
import { ChevronDown, FileText, Calendar, Package, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import LogisticsItemRow from '@/components/logistics/LogisticsItemRow';
import { CategoryBadges } from '@/components/logistics/CategoryBadges';
import { billingTotal, fmt } from '@/components/equipment/shared';

/**
 * PoGroupedAccordion — groups billable JobCostItem records by their po_number.
 * Each PO renders as a collapsible accordion (closed by default). The header
 * shows the PO number, supplier, date range, item count, and net total.
 * Expanding reveals the individual LogisticsItemRow items inside that PO.
 *
 * Items without a po_number are NOT rendered here — the parent keeps them in
 * the existing person-grouped list.
 */
export default function PoGroupedAccordion({
  poItems, suppliers, contractors, canSeeCosts, canEdit,
  selectedIds, onToggleSelect, onEdit, onDeleteItem, onOffHire, onLocationUpdate,
  updatingIds, assetMap, complianceByAssetId,
}) {
  const [openPos, setOpenPos] = useState(new Set());

  if (!poItems || poItems.length === 0) return null;

  // Group items by po_number
  const poGroups = poItems.reduce((acc, item) => {
    const po = item.po_number || '';
    if (!po) return acc; // skip items without a PO — parent handles those
    if (!acc[po]) acc[po] = [];
    acc[po].push(item);
    return acc;
  }, {});

  // Build PO summary objects and sort by earliest start_date (newest first)
  const poSummaries = Object.entries(poGroups).map(([po, items]) => {
    const total = items.reduce((s, c) => s + billingTotal(c), 0);
    const dates = items.map(c => c.start_date).filter(Boolean).sort();
    const earliest = dates[0] || '';
    const latest = items.map(c => c.end_date).filter(Boolean).sort().pop() || '';
    // Supplier: most common supplier_id among the items
    const supplierIds = items.map(c => c.supplier_id).filter(Boolean);
    const supplierId = supplierIds[0] || '';
    const supplier = supplierId ? suppliers.find(s => s.id === supplierId) : null;
    return { po, items, total, earliest, latest, supplier, supplierId, itemCount: items.length };
  }).sort((a, b) => (b.earliest || '').localeCompare(a.earliest || ''));

  if (poSummaries.length === 0) return null;

  const togglePo = (po) => {
    setOpenPos(prev => {
      const s = new Set(prev);
      if (s.has(po)) s.delete(po); else s.add(po);
      return s;
    });
  };

  return (
    <div className="space-y-2.5">
      {poSummaries.map(group => {
        const isOpen = openPos.has(group.po);
        return (
          <div key={group.po} className="hub-glass rounded-xl overflow-hidden">
            {/* Accordion header */}
            <button
              onClick={() => togglePo(group.po)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#2E5A1A]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{group.po}</p>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {group.itemCount} item{group.itemCount !== 1 ? 's' : ''}
                  </span>
                  <CategoryBadges items={group.items} />
                </div>
                <div className="flex items-center gap-2.5 mt-0.5 flex-wrap text-[11px] text-slate-500">
                  {group.supplier && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {group.supplier.name}
                    </span>
                  )}
                  {(group.earliest || group.latest) && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {group.earliest ? format(new Date(group.earliest + 'T00:00:00'), 'dd MMM') : '—'}
                      {group.latest && group.latest !== group.earliest ? ` → ${format(new Date(group.latest + 'T00:00:00'), 'dd MMM yyyy')}` : group.earliest ? format(new Date(group.earliest + 'T00:00:00'), 'yyyy') : ''}
                    </span>
                  )}
                </div>
              </div>
              {canSeeCosts && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#2E5A1A]">{fmt(group.total)}</p>
                  <p className="text-[10px] text-slate-400">net</p>
                </div>
              )}
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Accordion body — item rows */}
            {isOpen && (
              <div className="border-t border-slate-200/70 px-3 py-3 space-y-2 bg-slate-50/40">
                <div className="border-l-2 border-[#2E5A1A]/30 pl-3 space-y-2">
                  {group.items.map(c => (
                    <LogisticsItemRow
                      key={c.id}
                      item={c}
                      isSelected={selectedIds.has(c.id)}
                      onToggleSelect={onToggleSelect}
                      asset={c.site_asset_id ? assetMap[c.site_asset_id] : null}
                      supplier={c.supplier_id ? suppliers.find(s => s.id === c.supplier_id) : null}
                      contractor={c.contractor_id ? contractors.find(ct => ct.id === c.contractor_id) : null}
                      linkedItems={[]}
                      isUpdating={updatingIds.has(c.id)}
                      onEdit={onEdit}
                      onDelete={onDeleteItem}
                      onOffHire={onOffHire}
                      onLocationUpdate={onLocationUpdate}
                      canSelect={canEdit}
                      canEdit={canEdit}
                      showCost={canSeeCosts}
                      complianceItems={c.site_asset_id ? (complianceByAssetId[c.site_asset_id] || []) : []}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}