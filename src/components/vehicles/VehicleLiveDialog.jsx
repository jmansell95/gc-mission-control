import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigation, Gauge, Clock, MapPin, User, Zap, Route, FileBarChart } from 'lucide-react';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';

/**
 * VehicleLiveDialog — standard Dialog popup showing a vehicle's live status
 * (speed, ignition, location, driver, last seen) plus quick action buttons.
 * Replaces the custom fixed inset-0 panel that was in GeotabLiveMap.
 */
export default function VehicleLiveDialog({ vehicle, onClose, onSelectRoute, onShowHistory }) {
  const { label: address } = useReverseGeocode(vehicle?.lat, vehicle?.lng);
  if (!vehicle) return null;

  const isMoving = vehicle.ignition_on && (vehicle.speed_kph || 0) > 0;

  return (
    <Dialog open={!!vehicle} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center icon-tile-glow">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <span className="font-mono">{vehicle.registration_number || 'Vehicle'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Status + speed tiles */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`rounded-xl p-3 border ${vehicle.ignition_on ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Status</p>
              <p className="text-sm font-bold mt-1 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${vehicle.ignition_on ? 'bg-[#8DC63F] animate-pulse' : 'bg-slate-300'}`} />
                <span className={vehicle.ignition_on ? 'text-primary' : 'text-slate-500'}>{vehicle.ignition_on ? 'Engine On' : 'Engine Off'}</span>
              </p>
            </div>
            <div className="rounded-xl p-3 border bg-slate-50 border-slate-200">
              <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Gauge className="w-3 h-3" /> Speed</p>
              <p className="text-sm font-bold text-slate-700 mt-1">{Math.round(vehicle.speed_kph || 0)} <span className="text-[10px] font-normal">km/h</span></p>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl p-3 border bg-slate-50 border-slate-200">
            <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
            <p className="text-xs text-slate-600 mt-1">{address || (vehicle.lat != null ? `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` : '—')}</p>
          </div>

          {/* Last seen */}
          <div className="rounded-xl p-3 border bg-slate-50 border-slate-200">
            <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Last Seen</p>
            <p className="text-xs text-slate-600 mt-1">{vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
          </div>

          {/* Driver */}
          {vehicle.driver_name && (
            <div className="rounded-xl p-3 border bg-primary/5 border-primary/15 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{vehicle.driver_name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase text-primary/60 font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Driver</p>
                <p className="text-sm font-medium text-primary">{vehicle.driver_name}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { onSelectRoute?.(vehicle); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 command-gradient text-white rounded-lg text-xs font-bold hover:opacity-90 transition"
            >
              <Route className="w-3.5 h-3.5" /> View Route History
            </button>
            {onShowHistory && (
              <button
                onClick={() => { onShowHistory(vehicle); onClose(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
              >
                <FileBarChart className="w-3.5 h-3.5" /> Reports
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}