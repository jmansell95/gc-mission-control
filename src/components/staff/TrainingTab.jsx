import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  GraduationCap, CheckCircle2, AlertTriangle, Clock, Calendar, MapPin,
  Users, Award, IdCard, Car, ShieldCheck, FileText, CreditCard, ChevronDown,
  ChevronRight, BookOpen, UserPlus, ExternalLink, Sparkles, Plus,
} from 'lucide-react';
import { format, isFuture, isToday } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import { Skeleton, EmptyState } from '@/components/StateViews';
import RequestTrainingModal from './RequestTrainingModal';
import AddCompletedTrainingModal from './AddCompletedTrainingModal';

const ICON_MAP = { IdCard, Car, Award, CreditCard, FileText, ShieldCheck, GraduationCap };

const STATUS = {
  valid: { label: 'Valid', cls: 'bg-emerald-500 text-white', ring: 'ring-emerald-200' },
  expiring: { label: 'Expiring', cls: 'bg-amber-500 text-white', ring: 'ring-amber-200' },
  expired: { label: 'Expired', cls: 'bg-red-500 text-white', ring: 'ring-red-200' },
  booked: { label: 'Booked', cls: 'bg-blue-500 text-white', ring: 'ring-blue-200' },
  gap: { label: 'Gap', cls: 'bg-white text-red-500 border-2 border-dashed border-red-300', ring: 'ring-red-200' },
  not_required: { label: 'N/A', cls: 'bg-slate-100 text-slate-300', ring: 'ring-slate-100' },
};

const BOOKING_STATUS = {
  booked: { label: 'Booked', cls: 'bg-blue-100 text-blue-700' },
  attended: { label: 'Attended', cls: 'bg-violet-100 text-violet-700' },
  passed: { label: 'Passed', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  rebooked: { label: 'Rebooked', cls: 'bg-amber-100 text-amber-700' },
};

export default function TrainingTab({ staffId, staffName, teamId, canManageTeam }) {
  const [showHistory, setShowHistory] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showAddCompleted, setShowAddCompleted] = useState(false);

  const { data: compliance = [], isLoading: compLoading } = useQuery({
    queryKey: ['my-compliance', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId,
  });
  const { data: bookings = [], isLoading: bookLoading } = useQuery({
    queryKey: ['staff-training-history', staffId],
    queryFn: () => base44.entities.TrainingBooking.list('-created_date', 200),
    enabled: !!staffId,
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-training-tab'],
    queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200),
  });
  const { data: requirements = [] } = useQuery({
    queryKey: ['training-requirements-tab'],
    queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100),
  });
  const { data: teams = [] } = useQuery({ queryKey: ['teams-training-tab'], queryFn: () => base44.entities.Team.list() });
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-training-bookings-tab'],
    queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500),
    enabled: !!canManageTeam,
  });

  const myTeam = teams.find(t => t.id === teamId);
  const requiredQuals = myTeam?.required_qualifications || [];

  const categories = useMemo(() => {
    const seen = new Set();
    return requirements
      .filter(r => r.is_active !== false)
      .filter(r => { if (seen.has(r.qualification_type)) return false; seen.add(r.qualification_type); return true; })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [requirements]);

  const myCompliance = useMemo(
    () => compliance.filter(c => (c.reference_id === staffId || (staffName && c.reference_name === staffName)) && c.review_status !== 'rejected'),
    [compliance, staffId, staffName]
  );

  const getQualStatus = (qualType) => {
    if (requiredQuals.length > 0 && !requiredQuals.includes(qualType)) return 'not_required';
    const items = myCompliance.filter(c => c.qualification_type === qualType);
    for (const item of items) {
      if (item.status_override === 'not_required') return 'not_required';
      if (item.status_override === 'missing') continue;
      // Pending-review documents don't count as valid yet (awaiting manager approval)
      if (item.review_status === 'pending_review') continue;
      const days = complianceDaysUntil(item.expiry_date);
      if (days === null) return 'valid';
      if (days < 0) continue;
      if (days <= 30) return 'expiring';
      return 'valid';
    }
    const hasBooking = bookings.some(b => b.staff_id === staffId && b.status === 'booked' &&
      courses.find(c => c.id === b.course_id)?.category === qualType);
    if (hasBooking) return 'booked';
    return 'gap';
  };

  const myBookings = useMemo(() => bookings.filter(b => b.staff_id === staffId), [bookings, staffId]);
  const courseMap = useMemo(() => { const m = {}; courses.forEach(c => { m[c.id] = c; }); return m; }, [courses]);

  const upcoming = useMemo(() => myBookings.filter(b => {
    if (['passed', 'failed', 'rebooked'].includes(b.status)) return false;
    const c = courseMap[b.course_id];
    if (!c) return false;
    const d = new Date(c.start_date + 'T00:00:00');
    return isFuture(d) || isToday(d);
  }), [myBookings, courseMap]);

  const past = useMemo(() => myBookings.filter(b => {
    if (['passed', 'failed', 'rebooked'].includes(b.status)) return true;
    const c = courseMap[b.course_id];
    if (!c) return false;
    const d = new Date(c.start_date + 'T00:00:00');
    return !isFuture(d) && !isToday(d);
  }), [myBookings, courseMap]);

  // Team upcoming courses (for managers) — who is booked on each
  const teamUpcoming = useMemo(() => {
    if (!canManageTeam) return [];
    return courses
      .filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || isToday(new Date(c.start_date + 'T00:00:00')))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5)
      .map(c => ({
        course: c,
        attendees: allBookings.filter(b => b.course_id === c.id && b.staff_id).map(b => b.staff_name).filter(Boolean),
      }));
  }, [canManageTeam, courses, allBookings]);

  const isLoading = compLoading || bookLoading;

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Qualification Matrix — compact, no scroll */}
      <div className="insight-card rounded-2xl p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-violet-700" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-slate-900">My Qualifications</h3>
              <p className="text-[11px] text-slate-500">{categories.length} categories · {requiredQuals.length} required for your crew</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:flex-shrink-0">
            {canManageTeam && (
              <button onClick={() => setShowAddCompleted(true)} type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] active:scale-95 transition touch-manipulation shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Add Completed
              </button>
            )}
            <button onClick={() => setShowRequest(true)} type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 active:scale-95 transition touch-manipulation shadow-sm">
              <UserPlus className="w-3.5 h-3.5" /> Request
            </button>
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">No qualification categories configured.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map(c => {
              const st = getQualStatus(c.qualification_type);
              const cfg = STATUS[st];
              const Icon = ICON_MAP[c.icon] || Award;
              return (
                <div key={c.id} title={`${c.label}: ${cfg.label}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ring-1 ${cfg.cls} ${cfg.ring}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {c.short_code}
                </div>
              );
            })}
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
          {['valid', 'expiring', 'expired', 'booked', 'gap'].map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-3.5 h-3.5 rounded ${STATUS[k].cls}`} />
              <span className="text-[10px] font-medium text-slate-500">{STATUS[k].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming training */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Calendar className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-extrabold text-slate-900">My Booked Training</h3>
          <span className="text-xs text-slate-400">· {upcoming.length} upcoming</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 bg-white/40 text-center">
            <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="text-sm text-slate-400">No upcoming training. Tap "Request" above to ask your manager.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map(b => {
              const c = courseMap[b.course_id];
              if (!c) return null;
              const attendeeCount = allBookings.filter(ab => ab.course_id === c.id && ab.staff_id).length;
              return (
                <div key={b.id} className="insight-card rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{c.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BOOKING_STATUS[b.status]?.cls || 'bg-blue-100 text-blue-700'}`}>{BOOKING_STATUS[b.status]?.label || 'Booked'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(c.start_date + 'T00:00:00'), 'EEE dd MMM yyyy')}</span>
                      {c.start_time && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{c.start_time}{c.end_time ? `–${c.end_time}` : ''}</span>}
                    </div>
                    {c.venue && <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{c.venue}{c.address ? `, ${c.address}` : ''}</p>}
                    {c.provider && <p className="text-[11px] text-slate-400 mt-0.5">Provider: {c.provider}</p>}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                    <Users className="w-3 h-3" /> {attendeeCount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manager: team training overview */}
      {canManageTeam && teamUpcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Users className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-extrabold text-slate-900">Team Training</h3>
            <span className="text-xs text-slate-400">· who's booked on what</span>
          </div>
          <div className="space-y-2">
            {teamUpcoming.map(({ course: c, attendees }) => (
              <div key={c.id} className="insight-card rounded-2xl p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy')}{c.venue ? ` · ${c.venue}` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{attendees.length} booked</span>
                      {attendees.slice(0, 6).map((n, i) => (
                        <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{n}</span>
                      ))}
                      {attendees.length > 6 && <span className="text-[10px] text-slate-400">+{attendees.length - 6}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training history — collapsible */}
      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(s => !s)} className="w-full flex items-center gap-2 mb-3 px-1 group">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Training History</h3>
            <span className="text-xs text-slate-400">· {past.length}</span>
            <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
          {showHistory && (
            <div className="space-y-2 opacity-90">
              {past.map(b => {
                const c = courseMap[b.course_id];
                const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.booked;
                return (
                  <div key={b.id} className="rounded-xl p-3 border border-slate-100 bg-white/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
                      {b.status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                        b.status === 'failed' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                        <GraduationCap className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c?.title || b.certificate_title || 'Training Course'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {c?.start_date ? format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy') : ''}
                        {c?.provider ? ` · ${c.provider}` : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls} flex-shrink-0`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showRequest && (
        <RequestTrainingModal staffId={staffId} staffName={staffName} onClose={() => setShowRequest(false)} />
      )}
      {showAddCompleted && (
        <AddCompletedTrainingModal staffId={staffId} staffName={staffName} onClose={() => setShowAddCompleted(false)} />
      )}
    </div>
  );
}