import React, { useState } from 'react';
import { Edit2, Trash2, FileCheck, Package, Truck, MapPin, PackageCheck, Warehouse, Loader2, ShieldCheck, ShieldAlert, ShieldX, Wrench, ShoppingCart, HardHat, ChevronDown, ChevronUp, FileText, ExternalLink, Users, PenLine } from 'lucide-react';
import { format } from 'date-fns';
import { fmt as fmtMoney, billingTotal } from '@/components/equipment/shared';

const fmt = fmtMoney;

const categoryConfig = {
  hired_equipment: { label: 'Hired', icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, bg: 'bg-purple-50', text: 'text-purple-600' },
  internal_equipment: { label: 'Internal', icon: Wrench, bg: 'bg-blue-50', text: 'text-blue-600' },
  labour: { label: 'Labour', icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  contractor_supplied: { label: 'Contractor', icon: HardHat, bg: 'bg-indigo-50', text: 'text-indigo-600' },
};

const locationConfig = {
  yard: { label: 'Depot', icon: Warehouse, color: 'text-slate-600', bg: 'bg-slate-100', actionLabel: 'Load', actionIcon: Truck, actionBg: 'bg-blue-50 text-blue-700 hover:bg-blue-100', nextLoc: 'in_transit' },
  in_transit: { label: 'Transit', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', actionLabel: 'Drop', actionIcon: MapPin, actionBg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', nextLoc: 'site' },
  site: { label: 'On Site', icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50', actionLabel: 'Collect', actionIcon: PackageCheck, actionBg: 'bg-teal-50 text-teal-700 hover:bg-teal-100', nextLoc: 'returned' },
  returned: { label: 'Returned', icon: PackageCheck, color: 'text-teal-600', bg: 'bg-teal-50', actionLabel: 'Revert', actionIcon: MapPin, actionBg: 'text-slate-400 hover:text-slate-600', nextLoc: 'site' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-50 text-red-700 border border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldCheck, badge: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

export default function LogisticsItemRow({ item: c, isSelected, onToggleSelect, asset = null, supplier = null, contractor = null, linkedItems = [], isUpdating, onEdit, onDelete, onOffHire, onLocationUpdate, canSelect = true, canEdit = true, showCost = true, complianceItems = [] }) {
  const [expanded, setExpanded] = useState(false);
  const isContractorItem = c.category === 'contractor_supplied';
  const isLabourItem = c.category === 'labour';
  const isNoTracking = isContractorItem || isLabourItem;
  const loc = c.current_location || 'yard';
  const locCfg = locationConfig[loc] || locationConfig.yard;
  const cfg = categoryConfig[c.category] || categoryConfig.hired_equipment;
  const CatIcon = cfg.icon;
  const LocIcon = locCfg.icon;
  const cb = asset ? (complianceConfig[asset.compliance_status] || complianceConfig.unknown) : null;
  const ComplianceIcon = cb?.icon;
  const net = billingTotal(c);
  const hasLinked = linkedItems.length > 0;
  const cert = complianceItems.find(ci => ci.document_url);

  return (
    <div className={`border rounded-lg p-3 transition ${hasLinked ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2">
        {canSelect && !isNoTracking && (
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(c.id)} className="mt-1.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 flex-shrink-0" />
        )}
        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <CatIcon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{cfg.label}</span>
            {cb && ComplianceIcon && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${cb.badge}`}><ComplianceIcon className="w-2.5 h-2.5" /> {cb.label}</span>}
            {!isNoTracking && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${locCfg.bg} ${locCfg.color}`}><LocIcon className="w-2.5 h-2.5" /> {locCfg.label}</span>}
            {isLabourItem && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600"><Users className="w-2.5 h-2.5" /> Crew</span>}
            {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.po_number}</span>}
            {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isContractorItem ? (
              <>{contractor?.name || 'Contractor'} · {c.quantity} {c.unit_label}{c.quantity > 1 ? 's' : ''} · Supplied by contractor</>
            ) : isLabourItem ? (
              <>{c.responsible_person || 'Staff'} · {c.quantity} {c.unit_label}{c.quantity > 1 ? 's' : ''}{c.start_date && c.end_date ? ` · ${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}{showCost && ` · ${fmt(Number(c.unit_cost) || 0)}/${c.unit_label}`}</>
            ) : (
              <>
                {c.start_date && c.end_date ? `${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}
                {supplier && ` · ${supplier.name}`}
                {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                {showCost && ` · ${fmt(Number(c.unit_cost) || 0)}/${c.unit_label}`}
              </>
            )}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {!isNoTracking && isUpdating && (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
            {!isNoTracking && canEdit && c.category === 'hired_equipment' && (c.hire_status || 'active') === 'active' && (
              <button onClick={() => onOffHire(c)} className="text-[10px] px-2 py-1 rounded-lg font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition inline-flex items-center gap-0.5">
                <FileCheck className="w-3 h-3" /> Return
              </button>
            )}
            {c.order_slip_url && (
              <a href={c.order_slip_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded-lg font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition inline-flex items-center gap-0.5">
                <FileText className="w-3 h-3" /> Order slip <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {cert && (
              <a href={cert.document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-0.5">
                <FileText className="w-3 h-3" /> Certificate <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {c.on_site_signature_url && (
              <a href={c.on_site_signature_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-0.5" title={c.on_site_signed_by ? `Signed by ${c.on_site_signed_by}` : 'On-site receipt signature'}>
                <PenLine className="w-3 h-3" /> On-site sig <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {hasLinked && (
              <button onClick={() => setExpanded(!expanded)} className="text-[10px] px-2 py-1 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition inline-flex items-center gap-0.5">
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {linkedItems.length} linked
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {showCost && (isContractorItem ? (
            <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">Contractor</p>
          ) : (
            <p className="text-sm font-bold text-slate-900">{fmt(net)}</p>
          ))}
          {isLabourItem && showCost && (
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Labour</p>
          )}
          {canEdit && (
            <div className="flex items-center gap-0.5">
              <button onClick={() => onEdit(c)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDelete(c.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>
      {hasLinked && expanded && (
        <div className="ml-12 mt-2 space-y-1 border-l-2 border-blue-200 pl-3">
          {linkedItems.map(li => {
            const lcfg = categoryConfig[li.category] || categoryConfig.hired_equipment;
            const LIcon = lcfg.icon;
            const lloc = li.current_location || 'yard';
            const llocCfg = locationConfig[lloc] || locationConfig.yard;
            const lnet = billingTotal(li);
            return (
              <div key={li.id} className="flex items-center gap-2 py-0.5">
                <LIcon className={`w-3 h-3 ${lcfg.text} flex-shrink-0`} />
                <span className="text-xs font-medium text-slate-700 truncate">{li.description}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${llocCfg.bg} ${llocCfg.color}`}>{llocCfg.label}</span>
                {showCost && <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{fmt(lnet)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}