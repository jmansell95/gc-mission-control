import React from 'react';
import {
  Hash, Palette, Warehouse, User, Cog, Link2, ChevronRight,
  Activity, Clock, MapPin, Briefcase, Database, Wrench, Package, Anchor, Plug,
  Ruler, Fuel, Gauge,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import ComplianceCountdownRing from './ComplianceCountdownRing';
import MaintenanceGauge from './MaintenanceGauge';
import AssetPandaInfoPanel from '@/components/righub/AssetPandaInfoPanel';
import RawPandaDataPanel from './RawPandaDataPanel';
import AssetPandaImageGallery from './AssetPandaImageGallery';
import AssetColourDot from '@/components/assethub/AssetColourDot';

function InfoRow({ icon: Icon, label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />} {label}
      </span>
      <span className={`text-xs font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function conditionTone(cond) {
  if (!cond) return 'bg-slate-50 border-slate-100 text-slate-800';
  const c = String(cond).toLowerCase();
  if (c.includes('good') || c.includes('excellent') || c.includes('new') || c.includes('like new') || c.includes('ok') || c.includes('great')) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (c.includes('fair') || c.includes('used') || c.includes('average') || c.includes('wear') || c.includes('working')) return 'bg-amber-50 border-amber-200 text-amber-700';
  if (c.includes('poor') || c.includes('bad') || c.includes('repair') || c.includes('faulty') || c.includes('broken') || c.includes('scrap')) return 'bg-rose-50 border-rose-200 text-rose-700';
  return 'bg-slate-50 border-slate-100 text-slate-800';
}

function SpecTile({ icon: Icon, label, value, tone }) {
  const cls = tone || 'bg-slate-50 border-slate-100 text-slate-800';
  return (
    <div className={`rounded-xl p-3 border ${cls}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide flex items-center gap-1 mb-1 opacity-70">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </p>
      <p className="text-sm font-bold truncate">{value}</p>
    </div>
  );
}

/**
 * Overview tab — identity card, compliance ring, maintenance gauge,
 * current deployment, linked equipment, and Asset Panda info.
 */
export default function AssetOverviewTab({ asset, linkedItems = [], parentRig, currentDeployment, currentJob, onOpenLinked, onOpenRig }) {
  const showHoursGauge = (asset.asset_type === 'rig' || asset.asset_type === 'machinery') && asset.service_interval_hours;

  return (
    <div className="space-y-4">
      {/* Asset Panda photos */}
      {asset.panda_asset_id && (
        <AssetPandaImageGallery asset={asset} />
      )}

      {/* Linked to Rig — prominent card for equipment, shows the parent rig immediately */}
      {asset.asset_type !== 'rig' && parentRig && (
        <div className="insight-card rounded-2xl p-4 border-l-4 border-l-emerald-500">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-600" /> Linked to Rig
          </h3>
          <button
            onClick={() => onOpenRig?.(parentRig)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition text-left border border-emerald-200"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <AssetColourDot colour={parentRig.colour} size={12} />
                <p className="text-sm font-bold text-slate-900 truncate">{parentRig.name}</p>
              </div>
              <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                {parentRig.fleet_number ? `FAA ${parentRig.fleet_number}` : ''}{parentRig.serial_number ? `${parentRig.fleet_number ? ' · ' : ''}S/N ${parentRig.serial_number}` : ''}
                {parentRig.rig_type && parentRig.rig_type !== 'n/a' ? ` · ${parentRig.rig_type.toUpperCase()}` : ''}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          </button>
        </div>
      )}

      {/* Identity + Compliance ring side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identity card */}
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Cog className="w-4 h-4 text-[#2E5A1A]" /> Identity
          </h3>
          {asset.fleet_number && <InfoRow icon={Hash} label="FAA / Fleet No." value={asset.fleet_number} mono />}
          <InfoRow icon={Hash} label="Serial / Tag" value={asset.serial_number} mono />
          {asset.colour && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-slate-400" /> Colour
              </span>
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <AssetColourDot colour={asset.colour} size={14} />
                {asset.colour}
              </span>
            </div>
          )}
          <InfoRow icon={Warehouse} label="Storage Location" value={asset.storage_location} />
          <InfoRow icon={User} label="Responsible Person" value={asset.responsible_person} />
          <InfoRow icon={Wrench} label="Equipment Type" value={asset.equipment_type} />
          <InfoRow icon={Activity} label="Compliance Category" value={asset.compliance_category} />
          {asset.rig_type && asset.rig_type !== 'n/a' && <InfoRow icon={Cog} label="Rig Type" value={asset.rig_type.toUpperCase()} />}
          {asset.acquisition_date && <InfoRow icon={Clock} label="Acquired" value={safeFormat(asset.acquisition_date, 'dd MMM yyyy')} />}
        </div>

        {/* Compliance + Maintenance */}
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2E5A1A]" /> Health
          </h3>
          <div className="flex flex-col items-center gap-4">
            <ComplianceCountdownRing expiryDate={asset.compliance_expiry_date} size={128} />
            <div className="text-center">
              <p className="text-xs text-slate-500">Compliance expires</p>
              <p className="text-sm font-bold text-slate-800">
                {asset.compliance_expiry_date ? safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : 'No date on file'}
              </p>
            </div>
            {showHoursGauge && (
              <div className="w-full pt-2 border-t border-slate-100">
                <MaintenanceGauge
                  hoursSince={asset.hours_since_last_service || 0}
                  intervalHours={asset.service_interval_hours || 250}
                />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500">Total hours: <strong className="text-slate-800">{Math.round(asset.operating_hours || 0)}h</strong></span>
                  <span className="text-slate-500">Next service: <strong className="text-slate-800">{asset.next_service_date ? safeFormat(asset.next_service_date, 'dd MMM') : '—'}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Specifications — make, model, length, fuel type, condition, hours */}
      {(asset.make || asset.model || asset.length != null || asset.fuel_type || asset.condition || asset.hours_used != null) && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#2E5A1A]" /> Specifications
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {asset.make && <SpecTile icon={Cog} label="Make" value={asset.make} />}
            {asset.model && <SpecTile icon={Cog} label="Model" value={asset.model} />}
            {asset.length != null && <SpecTile icon={Ruler} label="Length" value={`${asset.length}m`} />}
            {asset.fuel_type && <SpecTile icon={Fuel} label="Fuel Type" value={asset.fuel_type} />}
            {asset.condition && <SpecTile icon={Gauge} label="Condition" value={asset.condition} tone={conditionTone(asset.condition)} />}
            {asset.hours_used != null && <SpecTile icon={Clock} label="Hours Used" value={`${asset.hours_used}h`} />}
          </div>
        </div>
      )}

      {/* Current deployment */}
      <div className="insight-card rounded-2xl p-4">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#2E5A1A]" /> Current Deployment
        </h3>
        {currentDeployment && currentJob ? (
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{currentJob.name}</p>
              <p className="text-xs text-slate-500 truncate">{currentJob.location || 'No location'}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white flex-shrink-0">
              {currentDeployment.status === 'on_site' ? 'On Site' : 'Assigned'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Warehouse className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">In Yard / Available</p>
              <p className="text-xs text-slate-500">Not currently assigned to a job</p>
            </div>
          </div>
        )}
      </div>

      {/* Linked equipment (rigs only) */}
      {asset.asset_type === 'rig' && linkedItems.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#2E5A1A]" /> Linked Equipment ({linkedItems.length})
          </h3>
          <div className="space-y-2">
            {linkedItems.map(item => {
              const TIcon = { machinery: Wrench, trailer: Package, lifting: Anchor, portable_appliance: Plug }[item.asset_type] || Cog;
              return (
                <button
                  key={item.id}
                  onClick={() => onOpenLinked?.(item.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <TIcon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <AssetColourDot colour={item.colour} size={10} />
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {item.fleet_number ? `FAA ${item.fleet_number}` : ''}{item.serial_number ? `${item.fleet_number ? ' · ' : ''}S/N ${item.serial_number}` : (item.equipment_type || item.asset_type || '')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset Panda info */}
      {asset.panda_asset_id && (
        <AssetPandaInfoPanel asset={asset} />
      )}

      {/* Raw Asset Panda Data — all pulled fields */}
      {asset.panda_raw_fields && Object.keys(asset.panda_raw_fields).length > 0 && (
        <RawPandaDataPanel rawFields={asset.panda_raw_fields} />
      )}

      {/* Tooling notes */}
      {asset.tooling_notes && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#2E5A1A]" /> Tooling Notes
          </h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{asset.tooling_notes}</p>
        </div>
      )}

      {/* General notes */}
      {asset.notes && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2E5A1A]" /> Notes
          </h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{asset.notes}</p>
        </div>
      )}
    </div>
  );
}