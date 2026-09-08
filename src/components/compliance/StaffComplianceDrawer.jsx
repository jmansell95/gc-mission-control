import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  X, ShieldCheck, GraduationCap, ClipboardCheck, Award, AlertTriangle,
  XCircle, Clock, CheckCircle2, FileText, Car, HardHat, IdCard,
} from 'lucide-react';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';

/**
 * Staff Compliance Drawer — a right-side sheet showing the full compliance
 * picture for a single staff member: Certs & Cards, Training Records, and
 * Mitti Safety Checks.
 *
 * Props:
 *   staff      — the Staff record (with `compliance` score attached)
 *   compliance — the compliance score object from calculateStaffComplianceScore
 *   onClose    — callback to close the drawer
 */
export default function StaffComplianceDrawer({ staff, compliance, onClose }) {
  const [openSection, setOpenSection] = useState('certs');

  if (!staff) return null;

  const { score, band, summary, certs, training, mitti } = compliance;
  const initials = (staff.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const bandStyles = {
    green: { bg: 'from-emerald-500 to-teal-600', text: 'text-emerald-700', bgSoft: 'bg-emerald-50', border: 'border-emerald-200' },
    amber: { bg: 'from-amber-500 to-orange-600', text: 'text-amber-700', bgSoft: 'bg-amber-50', border: 'border-amber-200' },
    red:   { bg: 'from-rose-500 to-red-600', text: 'text-rose-700', bgSoft: 'bg-rose-50', border: 'border-rose-200' },
  };
  const bs = bandStyles[band];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm animate-pop-in" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:max-w-2xl bg-slate-50 shadow-2xl animate-drawer-slide-in flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-br ${bs.bg} text-white px-5 py-4 flex items-center gap-3 flex-shrink-0`}>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {staff.avatar_url ? (
              <img src={staff.avatar_url} alt={staff.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{staff.name}</h2>
            <p className="text-xs text-white/80 truncate">
              {staff.job_title || 'Staff member'} · {staff.email || 'No email'}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold tabular-nums">{score}%</p>
            <p className="text-[10px] uppercase tracking-wide text-white/70">
              {band === 'green' ? 'Compliant' : band === 'amber' ? 'At Risk' : 'Critical'}
            </p>
          </div>
          <button onClick={onClose} className="ml-2 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary line */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex-shrink-0">
          <p className="text-xs text-slate-600">{summary}</p>
        </div>

        {/* Section tabs */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex gap-2 flex-shrink-0">
          <SectionTab
            active={openSection === 'certs'}
            onClick={() => setOpenSection('certs')}
            icon={IdCard}
            label="Certs & Cards"
            count={certs.details.length}
          />
          <SectionTab
            active={openSection === 'training'}
            onClick={() => setOpenSection('training')}
            icon={GraduationCap}
            label="Training"
            count={training.details.length}
          />
          <SectionTab
            active={openSection === 'mitti'}
            onClick={() => setOpenSection('mitti')}
            icon={ClipboardCheck}
            label="Mitti Checks"
            count={mitti.details.length}
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {openSection === 'certs' && <CertsSection details={certs.details} />}
          {openSection === 'training' && <TrainingSection details={training.details} bookings={[]} staffId={staff.id} />}
          {openSection === 'mitti' && <MittiSection details={mitti.details} />}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Section tab button
// ============================================================
function SectionTab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
        active
          ? 'bg-emerald-600 text-white shadow-md'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count > 0 && (
        <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/25' : 'bg-slate-200'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================
// Certs & Cards section
// ============================================================
function CertsSection({ details }) {
  if (!details.length) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <IdCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No certificates or cards on file</p>
        <p className="text-xs text-slate-400 mt-1">Add compliance items from the Staff Hub.</p>
      </div>
    );
  }

  const statusStyles = {
    valid:     { pill: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, color: 'text-emerald-600' },
    expiring:  { pill: 'bg-amber-100 text-amber-700', icon: Clock, color: 'text-amber-600' },
    expired:   { pill: 'bg-rose-100 text-rose-700', icon: XCircle, color: 'text-rose-600' },
    pending:   { pill: 'bg-blue-100 text-blue-700', icon: Clock, color: 'text-blue-600' },
    missing:   { pill: 'bg-slate-100 text-slate-600', icon: AlertTriangle, color: 'text-slate-500' },
    not_required: { pill: 'bg-slate-100 text-slate-400', icon: CheckCircle2, color: 'text-slate-400' },
    unknown:   { pill: 'bg-slate-100 text-slate-500', icon: AlertTriangle, color: 'text-slate-400' },
  };

  return (
    <div className="space-y-2">
      {details.map(ci => {
        const st = statusStyles[ci.status] || statusStyles.unknown;
        const Icon = st.icon;
        const days = complianceDaysUntil(ci.expiry_date);
        return (
          <div key={ci.id} className="insight-card rounded-2xl p-3.5 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 ${st.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900">{ci.title}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${st.pill}`}>
                  {ci.status === 'not_required' ? 'N/A' : ci.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                {ci.card_number && <span>Card: {ci.card_number}</span>}
                {ci.expiry_date && (
                  <span>
                    Expires: {formatComplianceDate(ci.expiry_date)}
                    {days != null && ci.status === 'valid' && days <= 30 && ` (${days}d)`}
                    {days != null && ci.status === 'expired' && ` (${Math.abs(days)}d ago)`}
                  </span>
                )}
                {ci.review_status === 'pending_review' && (
                  <span className="text-blue-600 font-medium">Pending manager review</span>
                )}
              </div>
              {ci.document_url && (
                <a href={ci.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1.5">
                  <FileText className="w-3 h-3" /> View document
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Training section
// ============================================================
function TrainingSection({ details, bookings, staffId }) {
  const { data: allBookings = [] } = useQuery({
    queryKey: ['staff-training-bookings', staffId],
    queryFn: () => base44.entities.TrainingBooking.filter({ staff_id: staffId }, '-created_date', 100),
    enabled: !!staffId,
  });

  if (!details.length && !allBookings.length) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No training categories assigned</p>
        <p className="text-xs text-slate-400 mt-1">Assign training categories from the Staff Hub.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Assigned categories */}
      {details.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Required Categories</p>
          <div className="space-y-2">
            {details.map(tc => (
              <div key={tc.id} className="insight-card rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tc.status === 'met' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {tc.status === 'met' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{tc.label}</p>
                  <p className="text-xs text-slate-500">
                    {tc.short_code && <span className="font-mono">{tc.short_code} · </span>}
                    {tc.status === 'met' ? 'Up to date' : 'Missing — booking required'}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  tc.status === 'met' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {tc.status === 'met' ? 'Met' : 'Gap'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking history */}
      {allBookings.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Training History</p>
          <div className="space-y-2">
            {allBookings.map(tb => (
              <div key={tb.id} className="insight-card rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tb.status === 'passed' ? 'bg-emerald-100 text-emerald-600' :
                  tb.status === 'failed' ? 'bg-rose-100 text-rose-600' :
                  tb.status === 'attended' ? 'bg-blue-100 text-blue-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  <Award className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {tb.certificate_title || tb.course_id || 'Training booking'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tb.completed_at ? format(new Date(tb.completed_at), 'dd MMM yyyy') : 'In progress'}
                    {tb.expiry_date && ` · expires ${formatComplianceDate(tb.expiry_date)}`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  tb.status === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                  tb.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                  tb.status === 'attended' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {tb.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Mitti safety checks section
// ============================================================
function MittiSection({ details }) {
  if (!details.length) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No Mitti safety checks recorded</p>
        <p className="text-xs text-slate-400 mt-1">Audits from Mitti/SafetyCulture will appear here once synced.</p>
      </div>
    );
  }

  const statusStyles = {
    recent:  { pill: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, color: 'text-emerald-600' },
    failed:  { pill: 'bg-rose-100 text-rose-700', icon: XCircle, color: 'text-rose-600' },
    old:     { pill: 'bg-slate-100 text-slate-500', icon: Clock, color: 'text-slate-400' },
  };

  const categoryIcons = {
    vehicle_check: Car,
    powra: ShieldCheck,
    equipment: HardHat,
    general: ClipboardCheck,
  };

  return (
    <div className="space-y-2">
      {details.map(a => {
        const st = statusStyles[a.status] || statusStyles.old;
        const Icon = st.icon;
        const CatIcon = categoryIcons[a.audit_category] || ClipboardCheck;
        return (
          <div key={a.id} className="insight-card rounded-2xl p-3.5 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 ${st.color}`}>
              <CatIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {a.audit_template_name || a.audit_title || 'Mitti audit'}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${st.pill}`}>
                  {a.status === 'recent' ? 'This week' : a.status === 'failed' ? 'Failed' : 'Older'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{(a.audit_category || 'general').replace(/_/g, ' ')}</span>
                {a.conducted_at && <span>{format(new Date(a.conducted_at), 'dd MMM yyyy · HH:mm')}</span>}
                {a.score_percentage != null && <span>Score: {Math.round(a.score_percentage)}%</span>}
                {a.pass_fail && a.pass_fail !== 'pending' && (
                  <span className={a.pass_fail === 'pass' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                    {a.pass_fail.toUpperCase()}
                  </span>
                )}
              </div>
              {a.job_name && <p className="text-xs text-slate-400 mt-0.5">Job: {a.job_name}</p>}
              {a.items_failed > 0 && (
                <p className="text-xs text-rose-600 mt-0.5">{a.items_failed} failed item{a.items_failed > 1 ? 's' : ''}</p>
              )}
            </div>
            {a.audit_report_url && (
              <a href={a.audit_report_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 flex-shrink-0">
                <FileText className="w-3 h-3" /> Report
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}