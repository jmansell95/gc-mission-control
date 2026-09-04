import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Navigation, Clock, Briefcase, MapPin, Truck } from 'lucide-react';
import { useLiveStaffLocations } from '@/hooks/useLiveStaffLocations';

// Shift state → colour + label
const SHIFT_STYLES = {
  travelling_to_site: { colour: '#f59e0b', label: 'Travelling to site' },
  on_site: { colour: '#10b981', label: 'On site' },
  travelling_home: { colour: '#3b82f6', label: 'Travelling home' },
  home: { colour: '#64748b', label: 'Home' },
  off_shift: { colour: '#94a3b8', label: 'Off shift' },
};

const PERSON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z"/></svg>';
const TRUCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3 6h13v9H3z"/><path d="M16 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';

function StaffMarker({ staff, onClick }) {
  const pos = [staff.lat, staff.lng];
  if (staff.lat == null || staff.lng == null) return null;
  const style = SHIFT_STYLES[staff.shiftState] || SHIFT_STYLES.off_shift;
  const colour = style.colour;
  const isProxy = staff.source === 'vehicle_proxy';

  const icon = window.L?.divIcon({
    html: `<div style="position:relative">
      <div style="background:${colour};width:30px;height:30px;border-radius:50%;border:3px solid white;${isProxy ? 'border-style:dashed;' : ''}box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
        ${isProxy ? TRUCK_SVG : PERSON_SVG}
      </div>
      ${staff.isMoving ? '<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ' + colour + ';opacity:0.35;animation:pulse 2s infinite"></div>' : ''}
      <div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);background:${colour};color:white;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis">${staff.staffName}</div>
      ${isProxy ? '<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#1e293b;color:#94a3b8;font-size:7px;font-weight:600;padding:1px 4px;border-radius:3px;white-space:nowrap">via vehicle</div>' : ''}
    </div>`,
    className: 'hazard-map-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  if (!icon) return <Marker position={pos}><Popup>{staff.staffName}</Popup></Marker>;

  const timeStr = staff.timestamp
    ? new Date(staff.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Marker position={pos} icon={icon} eventHandlers={{ click: () => onClick(staff) }}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm">{staff.staffName}</p>
          {isProxy && (
            <p className="flex items-center gap-1 text-indigo-600 font-medium">
              <Truck className="w-3 h-3" /> Via vehicle{staff.vehicleName ? ` · ${staff.vehicleName}` : ''}
            </p>
          )}
          <p className="flex items-center gap-1" style={{ color: colour }}>
            <span className="w-2 h-2 rounded-full" style={{ background: colour }} />
            {style.label}
          </p>
          {staff.jobName && <p className="flex items-center gap-1 text-slate-600"><Briefcase className="w-3 h-3" /> {staff.jobName}</p>}
          <p className="flex items-center gap-1 text-slate-500">
            {staff.isMoving ? <Navigation className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
            {staff.isMoving ? 'Moving' : 'Stationary'}
          </p>
          <p className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" /> {timeStr}</p>
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * StaffMapLayer — overlays live staff GPS pins on a Leaflet map.
 * Render inside a <MapContainer>. Pass a divisionId to scope the query.
 *
 * Phone-GPS pins use a solid border; vehicle-proxy pins use a dashed
 * border + a small "via vehicle" label so managers can distinguish them
 * at a glance.
 *
 * Props:
 *   - divisionId: string — which division's crew to show
 *   - show: boolean — whether to render the layer (toggle on/off)
 *   - onStaffClick: (staff) => void — called when a staff pin is clicked
 */
export default function StaffMapLayer({ divisionId, show = true, onStaffClick }) {
  const { liveStaff } = useLiveStaffLocations(divisionId);

  const visible = useMemo(
    () => liveStaff.filter(s => s.shiftState !== 'home' && s.shiftState !== 'off_shift'),
    [liveStaff],
  );

  if (!show) return null;

  return (
    <>
      {visible.map(s => (
        <StaffMarker key={s.staffId + (s.source || 'phone')} staff={s} onClick={onStaffClick || (() => {})} />
      ))}
    </>
  );
}