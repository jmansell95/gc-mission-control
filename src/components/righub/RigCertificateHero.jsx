import React from 'react';
import {
  ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  CalendarClock, FileText, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { COMPLIANCE_META } from '@/utils/rigRollup';
import { safeFormat } from '@/utils/format';

const RING_META = {
  compliant: { color: '#10b981', pct: 100, Icon: ShieldCheck },
  expiring: { color: '#f59e0b', pct: 70, Icon: ShieldAlert },
  expired: { color: '#ef4444', pct: 25, Icon: ShieldX },
  unknown: { color: '#94a3b8', pct: 8, Icon: HelpCircle },
};

/**
 * RigCertificateHero — a large, certificate-first compliance hero shown at
 * the top of the RigDetailDrawer and EquipmentDetailDrawer. Features a big
 * circular compliance ring containing the asset photo (or type icon fallback),
 * a bold status label, the expiry date, and a "View Certificate" link.
 *
 * This is the "front and centre" rig certificate view: compliant/not status
 * is the first thing the user sees when they open a rig.
 */
export default function RigCertificateHero({ asset, onOpenCert }) {
  if (!asset) return null;
  const status = asset.compliance_status || 'unknown';
  const meta = COMPLIANCE_META[status] || COMPLIANCE_META.unknown;
  const ring = RING_META[status] || RING_META.unknown;
  const RingIcon = ring.Icon;

  const photo = asset.panda_image_urls?.[0];
  const photoUrl = photo?.medium || photo?.url;
  const expiry = asset.compliance_expiry_date;
  const lastChecked = asset.compliance_last_checked;

  // Large ring dimensions
  const radius = 52;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (ring.pct / 100) * circumference;

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Status-coloured top strip */}
      <div className="h-1.5" style={{ background: ring.color }} />

      <div className="p-5 flex flex-col items-center text-center">
        {/* Large circular compliance ring with photo/icon centre */}
        <div className="relative w-32 h-32 mb-3">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
            {/* Progress */}
            <circle
              cx="60" cy="60" r={radius} fill="none" stroke={ring.color} strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          {/* Centre content — photo or icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {photoUrl ? (
              <img src={photoUrl} alt={asset.name || ''} loading="lazy"
                className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-md">
                <RingIcon className="w-9 h-9" style={{ color: ring.color }} />
              </div>
            )}
          </div>
        </div>

        {/* Status label — bold and prominent */}
        <div className="flex items-center gap-2 mb-1">
          <RingIcon className="w-5 h-5" style={{ color: ring.color }} />
          <h3 className="text-lg font-bold" style={{ color: ring.color }}>{meta.label}</h3>
        </div>

        {/* Expiry date */}
        <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-3">
          <CalendarClock className="w-3.5 h-3.5" />
          {expiry ? `Expires ${safeFormat(expiry, 'dd MMM yyyy')}` : 'No expiry — lifetime compliance'}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onOpenCert && (
            <button onClick={onOpenCert}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#1c4a12] transition shadow-sm">
              <FileText className="w-3.5 h-3.5" /> View Certificate
            </button>
          )}
          {lastChecked && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <CheckCircle2 className="w-3 h-3" /> Checked {safeFormat(lastChecked, 'dd MMM yyyy')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}