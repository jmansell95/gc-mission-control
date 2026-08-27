import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Search, CheckCircle2, AlertTriangle, Clock, Calendar, GraduationCap,
  ArrowRight, Plus, ShieldCheck, Users, UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { complianceDaysUntil, formatComplianceDate } from '@/utils/complianceDate';
import AddCompletedTrainingModal from '@/components/staff/AddCompletedTrainingModal';

const STATUS_META = {
  valid: { label: 'Valid', cls: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring', cls: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  expired: { label: 'Expired', cls: 'bg-red-500 text-white', dot: 'bg-red-500' },
  booked: { label: 'Booked', cls: 'bg-blue-500 text-white', dot: 'bg-blue-500' },
  gap: { label: 'Gap', cls: 'bg-white text-red-500 border-2 border-dashed border-red-400', dot: 'bg-red-400' },
  not_required: { label: 'N/A', cls: 'bg-slate-100 text-slate-300', dot: 'bg-slate-200' },
};

/**
 * TrainingStaffCardGrid — staff-card grid grouped into two columns:
 * 'Fully Qualified' on the left, 'Issues to Review' (gaps + expiring) on
 * the right. Each card shows avatar, name, team, an OK/issues badge,
 * qualification chips with expiry dates on critical items, booked count,
 * and a View Profile button. Clicking a card opens the detail drawer.
 */
export default function TrainingStaffCardGrid({ staff, teams, compliance, bookings, courses, requirements, getQualStatus, onBookTraining }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAddCompleted, setShowAddCompleted] = useState(null);

  const categories = useMemo(() => {
    const seen = new Set();
    return requirements
      .filter(r => r.is_active !== false)
      .filter(r => { if (seen.has(r.qualification_type)) return false; seen.add(r.qualification_type); return true; })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [requirements]);

  const teamName = (id) => {
    const t = teams.find(t => t.id === id);
    if (!t) return '—';
    const p = teams.find(p => p.id === t.parent_team_id);
    return p ? `${p.name} — ${t.name}` : t.name;
  };

  const filtered = useMemo(() => staff.filter(m => {
    const ms = !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.email || '').toLowerCase().includes(search.toLowerCase());
    const mt = teamFilter === 'all' || m.team_id === teamFilter;
    return ms && mt && m.is_active !== false;
  }), [staff, search, teamFilter]);

  const staffWithStats = useMemo(() => filtered.map(m => {
    const gapCount = categories.filter(c => {
      const st = getQualStatus(m, c.qualification_type);
      return st === 'gap' || st === 'expired';
    }).length;
    const expiringCount = categories.filter(c => getQualStatus(m, c.qualification_type) === 'expiring').length;
    const bookedCount = categories.filter(c => getQualStatus(m, c.qualification_type) === 'booked').length;
    return { member: m, gapCount, expiringCount, bookedCount, isFullyQualified: gapCount === 0 && expiringCount === 0 };
  }), [filtered, categories, getQualStatus]);

  const qualified = staffWithStats.filter(s => s.isFullyQualified);
  const issues = staffWithStats.filter(s => !s.isFullyQualified);

  const stats = useMemo(() => {
    let gaps = 0, expiring = 0, booked = 0;
    staffWithStats.forEach(s => {
      if (s.gapCount > 0) gaps++;
      if (s.expiringCount > 0) expiring++;
      if (s.bookedCount > 0) booked++;
    });
    return { total: staffWithStats.length, qualified: qualified.length, gaps, expiring, booked };
  }, [staffWithStats, qualified]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Users} label="Total Crew" value={stats.total} gradient="stat-gradient-brand" />
        <StatTile icon={CheckCircle2} label="Fully Qualified" value={stats.qualified} gradient="stat-gradient-emerald" />
        <StatTile icon={AlertTriangle} label="Training Gaps" value={stats.gaps} gradient="stat-gradient-rose" />
        <StatTile icon={Clock} label="Expiring Soon" value={stats.expiring} gradient="stat-gradient-amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crew…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/10 focus:border-[#2E5A1A]" />
        </div>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/10 focus:border-[#2E5A1A]">
          <option value="all">All Crews</option>
          {teams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
        </select>
      </div>

      {/* Two-column grouped layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fully Qualified */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-700">Fully Qualified</h3>
            <span className="text-xs text-slate-400">· {qualified.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {qualified.map(({ member: m, gapCount, expiringCount, bookedCount }) => (
              <StaffCard key={m.id} m={m} teamName={teamName} categories={categories} getQualStatus={getQualStatus}
                compliance={compliance} bookedCount={bookedCount} isFullyQualified onClick={() => setSelectedStaff(m)} />
            ))}
            {qualified.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No fully qualified crew yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Issues to Review */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-700">Issues to Review</h3>
            <span className="text-xs text-slate-400">· {issues.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {issues.map(({ member: m, gapCount, expiringCount, bookedCount }) => (
              <StaffCard key={m.id} m={m} teamName={teamName} categories={categories} getQualStatus={getQualStatus}
                compliance={compliance} bookedCount={bookedCount} gapCount={gapCount} expiringCount={expiringCount}
                onClick={() => setSelectedStaff(m)} />
            ))}
            {issues.length === 0 && (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-emerald-700 font-medium">No issues — everyone's up to date.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff training detail drawer */}
      {selectedStaff && (
        <StaffTrainingDrawer
          staff={selectedStaff}
          teams={teams}
          categories={categories}
          compliance={compliance}
          bookings={bookings}
          courses={courses}
          getQualStatus={getQualStatus}
          onClose={() => setSelectedStaff(null)}
          onBookTraining={(ids, cat) => { setSelectedStaff(null); onBookTraining(ids, cat); }}
          onOpenProfile={() => { navigate('/staff-profile', { state: { staffId: selectedStaff.id } }); setSelectedStaff(null); }}
          onAddCompleted={() => setShowAddCompleted(selectedStaff)}
        />
      )}
      {showAddCompleted && (
        <AddCompletedTrainingModal
          staffId={showAddCompleted.id}
          staffName={showAddCompleted.name}
          onClose={() => setShowAddCompleted(null)}
        />
      )}
    </div>
  );
}

function StaffCard({ m, teamName, categories, getQualStatus, compliance, bookedCount, isFullyQualified, gapCount, expiringCount, onClick }) {
  return (
    <button onClick={onClick} type="button"
      className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 text-left relative overflow-hidden hover:shadow-md hover:border-[#2E5A1A]/30 transition">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{m.name.charAt(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{teamName(m.team_id)}</p>
        </div>
        <div className="flex-shrink-0">
          {isFullyQualified ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3 h-3" /> {(gapCount || 0) + (expiringCount || 0)} issue{((gapCount || 0) + (expiringCount || 0)) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {categories.map(cat => {
          const st = getQualStatus(m, cat.qualification_type);
          const meta = STATUS_META[st] || STATUS_META.not_required;
          const items = compliance.filter(c =>
            (c.reference_id === m.id || c.reference_name === m.name) &&
            c.qualification_type === cat.qualification_type
          );
          const latest = items[0];
          const expiryLabel = latest?.expiry_date ? formatComplianceDate(latest.expiry_date) : null;
          return (
            <span key={cat.id} title={`${cat.label}: ${meta.label}${expiryLabel ? ' · ' + expiryLabel : ''}`}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
              {meta.dot && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
              {cat.short_code}
              {expiryLabel && (st === 'expiring' || st === 'expired') && (
                <span className="opacity-80 font-medium">({expiryLabel})</span>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        {bookedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600">
            <Calendar className="w-3 h-3" /> {bookedCount} booked
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#2E5A1A]">
          View Profile <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

/**
 * StaffTrainingDrawer — slide-in drawer showing a staff member's full
 * qualification list, booked courses, and training gaps with Book
 * Training actions and a link to their full staff profile.
 */
function StaffTrainingDrawer({ staff, teams, categories, compliance, bookings, courses, getQualStatus, onClose, onBookTraining, onOpenProfile, onAddCompleted }) {
  const teamName = (id) => {
    const t = teams.find(t => t.id === id);
    return t ? t.name : '—';
  };

  const myBookings = bookings.filter(b => b.staff_id === staff.id && b.status === 'booked');
  const gapCategories = categories.filter(c => {
    const st = getQualStatus(staff, c.qualification_type);
    return st === 'gap' || st === 'expired' || st === 'expiring';
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-base">{staff.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base truncate">{staff.name}</h3>
              <p className="text-xs text-white/70 truncate">{teamName(staff.team_id)}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <span className="sr-only">Close</span> ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onOpenProfile}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition">
              <GraduationCap className="w-4 h-4" /> Full Profile
            </button>
            <button onClick={onAddCompleted}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
              <Plus className="w-4 h-4" /> Add Training
            </button>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Qualifications</h4>
            <div className="space-y-1.5">
              {categories.map(cat => {
                const st = getQualStatus(staff, cat.qualification_type);
                const meta = STATUS_META[st] || STATUS_META.not_required;
                const items = compliance.filter(c =>
                  (c.reference_id === staff.id || c.reference_name === staff.name) &&
                  c.qualification_type === cat.qualification_type
                );
                const latest = items[0];
                const expiry = latest?.expiry_date;
                const days = expiry ? complianceDaysUntil(expiry) : null;
                return (
                  <div key={cat.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold ${meta.cls}`}>
                      {cat.short_code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{cat.label}</p>
                      <p className="text-[10px] text-slate-400">
                        {meta.label}
                        {days != null && days >= 0 && ` · ${days}d left`}
                        {days != null && days < 0 && ` · ${Math.abs(days)}d expired`}
                      </p>
                    </div>
                    {(st === 'gap' || st === 'expired' || st === 'expiring') && (
                      <button onClick={() => onBookTraining([staff.id], cat.qualification_type)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[#2E5A1A] text-white hover:bg-[#1c4a12] transition">
                        <UserPlus className="w-3 h-3" /> Book
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {myBookings.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Booked Courses</h4>
              <div className="space-y-1.5">
                {myBookings.map(b => {
                  const course = courses.find(c => c.id === b.course_id);
                  return (
                    <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{course?.title || 'Course'}</p>
                        <p className="text-[10px] text-slate-400">
                          {course?.start_date ? format(new Date(course.start_date + 'T00:00'), 'dd MMM yyyy') : 'TBC'}
                          {course?.venue ? ` · ${course.venue}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {gapCategories.length > 0 && (
            <button onClick={() => onBookTraining([staff.id])}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition border border-amber-200">
              <UserPlus className="w-4 h-4" /> Book Training for {gapCategories.length} Gap{gapCategories.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`${gradient} rounded-2xl p-4 text-white relative overflow-hidden shadow-sm`}>
      <Icon className="absolute right-3 top-3 w-7 h-7 opacity-20" />
      <div className="relative">
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-extrabold tabular-nums mt-1">{value}</p>
      </div>
    </div>
  );
}