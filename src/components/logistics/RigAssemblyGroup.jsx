import React, { useState } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronUp, Layers, ShieldCheck, ShieldAlert, ShieldX, Truck, MapPin, PackageCheck, Warehouse, Loader2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import LogisticsItemRow from '@/components/logistics/LogisticsItemRow';
import { fmt as fmtMoney, billingTotal } from '@/components/equipment/shared';

const fmt = fmtMoney;

const complianceBadge = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'bg-red-50 text-red-700 border border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldCheck, cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const gearLocConfig = {
  yard: { label: 'Depot', bg: 'bg-slate-100', color: 'text-slate-600', nextLoc: 'in_transit', actionLabel: 'Load', actionBg: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  in_transit: { label: 'Transit', bg: 'bg-blue-50', color: 'text-blue-600', nextLoc: 'site', actionLabel: 'Drop', actionBg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  site: { label: 'On Site', bg: 'bg-emerald-50', color: 'text-emerald-600', nextLoc: 'returned', actionLabel: 'Collect', actionBg: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
  returned: { label: 'Returned', bg: 'bg-teal-50', color: 'text-teal-600', nextLoc: 'site', actionLabel: 'Revert', actionBg: 'text-slate-400 hover:text-slate-600' },
};

export default function RigAssemblyGroup({ rigItem, linkedItems, asset, suppliers, contractors, canSeeCosts, canEdit, selectedIds, onToggleSelect, onEdit, onDeleteItem, onDeleteAssembly, onOffHire, onLocationUpdate, updatingIds, assetMap, complianceByAssetId = {} }) {
  const [expanded, setExpanded] = useState(true);
  const assemblyTotal = billingTotal(rigItem) + linkedItems.reduce((s, li) => s + billingTotal(li), 0);
  const rigAsset = rigItem.site_asset_id ? assetMap[rigItem.site_asset_id] : null;
  const complianceStatus = rigAsset?.compliance_status || 'unknown';
  const cb = complianceBadge[complianceStatus] || complianceBadge.unknown;
  const ComplianceIcon = cb.icon;
  const rigCert = (rigItem.site_asset_id && complianceByAssetId[rigItem.site_asset_id] || []).find(ci => ci.document_url);

  return (
    <div className="border-2 border-blue-200 rounded-xl overflow-hidden bg-blue-50/20">
      {/* Assembly Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-100/50 border-b border-blue-200">
        <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-blue-700 hover:bg-blue-200 rounded transition flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <Layers className="w-4 h-4 text-blue-700 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{rigItem.description}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Rig Assembly · {linkedItems.length + 1} items</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${cb.cls}`}>
              <ComplianceIcon className="w-2.5 h-2.5" /> {cb.label}
            </span>
            {rigCert && (
              <a href={rigCert.document_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-0.5">
                <FileText className="w-2.5 h-2.5" /> Cert <ExternalLink className="w-2 h-2" />
              </a>
            )}
          </div>
        </div>
        {canSeeCosts && (
          <span className="text-xs font-bold text-slate-700 flex-shrink-0">{fmt(assemblyTotal)}</span>
        )}
        {canEdit && (
          <button onClick={() => onDeleteAssembly(rigItem, linkedItems)}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 transition flex-shrink-0"
            title="Delete rig and all linked gear">
            <Trash2 className="w-3 h-3" /> Delete all
          </button>
        )}
      </div>

      {/* Assembly Body */}
      {expanded && (
        <div className="p-3 space-y-2">
          {/* Rig row */}
          <LogisticsItemRow
            item={rigItem}
            isSelected={selectedIds.has(rigItem.id)}
            onToggleSelect={onToggleSelect}
            asset={rigItem.site_asset_id ? assetMap[rigItem.site_asset_id] : null}
            supplier={rigItem.supplier_id ? suppliers.find(s => s.id === rigItem.supplier_id) : null}
            contractor={rigItem.contractor_id ? contractors.find(ct => ct.id === rigItem.contractor_id) : null}
            linkedItems={[]}
            isUpdating={updatingIds.has(rigItem.id)}
            onEdit={onEdit}
            onDelete={() => onDeleteAssembly(rigItem, linkedItems)}
            onOffHire={onOffHire}
            onLocationUpdate={onLocationUpdate}
            canSelect={canSeeCosts}
            canEdit={canEdit}
            showCost={canSeeCosts}
            complianceItems={rigItem.site_asset_id ? (complianceByAssetId[rigItem.site_asset_id] || []) : []}
          />

          {/* Linked gear rows */}
          <div className="ml-4 sm:ml-6 space-y-1.5 border-l-2 border-blue-200 pl-3">
            {linkedItems.map(li => {
              const loc = li.current_location || 'yard';
              const locCfg = gearLocConfig[loc] || gearLocConfig.yard;
              const net = billingTotal(li);
              const isUpdating = updatingIds.has(li.id);
              return (
                <div key={li.id} className="flex items-center gap-2 py-1.5 px-2.5 bg-white rounded-lg border border-slate-100">
                  {canSeeCosts && (
                    <input type="checkbox" checked={selectedIds.has(li.id)} onChange={() => onToggleSelect(li.id)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 flex-shrink-0" />
                  )}
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Layers className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 truncate">{li.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${locCfg.bg} ${locCfg.color}`}>{locCfg.label}</span>
                      {li.reference_number && <span className="text-[9px] font-mono text-slate-400">Ref: {li.reference_number}</span>}
                      {li.po_number && <span className="text-[9px] font-mono text-emerald-600">PO: {li.po_number}</span>}
                      {li.site_asset_id && complianceByAssetId[li.site_asset_id] && (() => {
                        const cert = complianceByAssetId[li.site_asset_id].find(ci => ci.document_url);
                        return cert ? (
                          <a href={cert.document_url} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-0.5">
                            <FileText className="w-2.5 h-2.5" /> Cert <ExternalLink className="w-2 h-2" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isUpdating && (
                      <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                    )}
                    {canSeeCosts && <span className="text-xs text-slate-400">{fmt(net)}</span>}
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => onEdit(li)} className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => onDeleteItem(li.id)} className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}