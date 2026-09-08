import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Users, Loader2, ShieldCheck, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { calculateStaffComplianceScore, findGeotechnicalDivision } from '@/utils/staffCompliance';
import StaffComplianceDrawer from '@/components/compliance/StaffComplianceDrawer';

/**
 * Staff Compliance Directory — a drill-down directory of all active Geotechnical
 * staff, each with a compliance score badge and a one-line summary. Clicking a
 * staff member opens a full-width drawer with certs, training, and Mitti checks.
 *
 * Locked to the Geotechnical division (no switcher).
 */
export default function StaffComplianceDirectory() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  // Find the Geotechnical division
  const { data: geoDivision, isLoading: isLoadingDiv } = useQuery({
    queryKey: ['geotechnical-division'],
    queryFn: () => findGeotechnicalDivision(base44),
    staleTime: 60000,
  });

  const divisionId = geoDivision?.id;

  // Fetch all active Geotechnical staff
  const { data: staff = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['geo-staff-compliance', divisionId],
    queryFn: () => base44.entities.Staff.filter({ is_active: true, division_id: divisionId }, 'name', 500),
    enabled: !!divisionId,
  });

  // Fetch all compliance items for these staff (category: staff)
  const { data: complianceItems = [], isLoading: isLoadingCerts } = useQuery({
    queryKey: ['geo-staff-certs', divisionId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }, '-created_date', 1000),
    enabled: !!divisionId,
  });

  // Fetch all training bookings for these staff
  const { data: trainingBookings = [], isLoading: isLoadingTraining } = useQuery({
    queryKey: ['geo-staff-training', divisionId],
    queryFn: () => base44.entities.TrainingBooking.list('-created_date', 1000),
    enabled: !!divisionId,
  });

  // Fetch all training requirements (to resolve training_category_ids)
  const { data: trainingReqs = [] } = useQuery({
    queryKey: ['training-requirements-all'],
    queryFn: () => base44.entities.TrainingRequirement.filter({ is_active: true }, 'sort_order', 200),
    enabled: !!divisionId,
  });

  // Fetch all Mitti safety reports attributed to staff
  const { data: mittiAudits = [], isLoading: isLoadingMitti } = useQuery({
    queryKey: ['mitti-audits-all-staff'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
    enabled: !!divisionId,
  });

  const isLoading = isLoadingDiv || isLoadingStaff || isLoadingCerts || isLoadingTraining || isLoadingMitti;

  // Build per-staff compliance scores
  const staffWithScores = useMemo(() => {
    if (!staff.length) return [];
    return staff.map(s => {
      const staffCerts = complianceItems.filter(ci => ci.reference_id === s.id);
      const staffTraining = trainingBookings.filter(tb => tb.staff_id === s.id);
      const staffMitti = mittiAudits.filter(a => a.auditor_staff_id === s.id || a.auditor_email === s.email);
      const assignedCategoryIds = s.training_category_ids || [];
      const assignedCategories = trainingReqs.filter(tr => assignedCategoryIds.includes(tr.id));
      const score = calculateStaffComplianceScore({
        complianceItems: staffCerts,
        trainingCategories: assignedCategories,
        trainingBookings: staffTraining,
        mittiAudits: staffMitti,
      });
      return { ...s, compliance: score };
    });
  }, [staff, complianceItems, trainingBookings, mittiAudits, trainingReqs]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = staffWithScores;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name?.toLowerCase().includes(q));
    }
    if (sortBy === 'score-asc') {
      result = [...result].sort((a, b) => a.compliance.score - b.compliance.score);
    } else if (sortBy === 'score-desc') {
      result = [...result].sort((a, b) => b.compliance.score - a.compliance.score);
    } else {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return result;
  }, [staffWithScores, search, sortBy]);

  const selectedStaff = staffWithScores.find(s => s.id === selectedStaffId);

  // Summary KPIs
  const kpis = useMemo(() => {
    if (!staffWithScores.length) return { total: 0, green: 0, amber: 0, red: 0 };
    return {
      total: staffWithScores.length,
      green: staffWithScores.filter(s => s.compliance.band === 'green').length,
      amber: staffWithScores.filter(s => s.compliance.band === 'amber').length,
      red: staffWithScores.filter(s => s.compliance.band === 'red').length,
    };
  }, [staffWithScores]);

  if (isLoadingDiv) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!geoDivision) {
    return (
      <div className="insight-card rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No Geotechnical division found</p>
        <p className="text-xs text-slate-500 mt-1">Create a division with 'Geotechnical' in the name in Settings → Divisions to use this view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile icon={Users} label="Total Staff" value={kpis.total} color="slate" />
        <KpiTile icon={ShieldCheck} label="Compliant" value={kpis.green} color="emerald" />
        <KpiTile icon={AlertTriangle} label="At Risk" value={kpis.amber} color="amber" />
        <KpiTile icon={XCircle} label="Critical" value={kpis.red} color="rose" />
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <option value="name">Sort: Name (A-Z)</option>
          <option value="score-asc">Sort: Lowest Score First</option>
          <option value="score-desc">Sort: Highest Score First</option>
        </select>
      </div>

      {/* Staff directory list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No staff found</p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Try a different search.' : 'No active staff in the Geotechnical division.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <StaffRow key={s.id} staff={s} onClick={() => setSelectedStaffId(s.id)} />
          ))}
        </div>
      )}

      {/* Drill-down drawer */}
      {selectedStaff && (
        <StaffComplianceDrawer
          staff={selectedStaff}
          compliance={selectedStaff.compliance}
          onClose={() => setSelectedStaffId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Staff row — compact card with avatar, name, score badge, summary
// ============================================================
function StaffRow({ staff, onClick }) {
  const initials = (staff.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const { score, band, summary } = staff.compliance;
  const bandStyles = {
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  const dotColor = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
  };

  return (
    <button
      onClick={onClick}
      className="w-full hub-glass rounded-2xl p-3.5 flex items-center gap-3 text-left hover:shadow-md transition-all active:scale-[0.99] group"
    >
      {/* Avatar / initials */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {staff.avatar_url ? (
          <img src={staff.avatar_url} alt={staff.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Name + summary */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate">{staff.name}</p>
          {staff.job_title && (
            <span className="text-[10px] text-slate-400 truncate hidden sm:inline">· {staff.job_title}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{summary}</p>
      </div>

      {/* Score badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bandStyles[band]} flex-shrink-0`}>
        <span className={`w-2 h-2 rounded-full ${dotColor[band]}`} />
        <span className="text-sm font-bold tabular-nums">{score}%</span>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
    </button>
  );
}

// ============================================================
// KPI tile
// ============================================================
function KpiTile({ icon: Icon, label, value, color }) {
  const colorMap = {
    slate: 'text-slate-600 bg-slate-100',
    emerald: 'text-emerald-700 bg-emerald-100',
    amber: 'text-amber-700 bg-amber-100',
    rose: 'text-rose-700 bg-rose-100',
  };
  return (
    <div className="hub-glass rounded-2xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}