import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, CheckCircle2, AlertTriangle, Clock, Calendar, GraduationCap,
  ArrowRight, Plus, ShieldCheck, Users, UserPlus, HardHat, Briefcase, Pencil,
  Check, X, Tag, Layers, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { complianceDaysUntil, formatComplianceDate } from '@/utils/complianceDate';
import AddCompletedTrainingModal from '@/components/staff/AddCompletedTrainingModal';
import EditTrainingInlineForm from '@/components/training/EditTrainingInlineForm';
import StaffCategoryPopup from '@/components/training/StaffCategoryPopup';
import BulkCategoryModal from '@/components/training/BulkCategoryModal';
import { useToast } from '@/components/ui/use-toast';

const STATUS_META = {
  valid: { label: 'Valid', cls: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  expiring: { label: 'Expiring', cls: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  expired: { label: 'Expired', cls: 'bg-red-500 text-white', dot: 'bg-red-500' },
  booked: { label: 'Booked', cls: 'bg-blue-500 text-white', dot: 'bg-blue-500' },
  gap: { label: 'Gap', cls: 'bg-white text-red-500 border-2 border-dashed border-red-400', dot: 'bg-red-400' },
  not_assigned: { label: 'N/A', cls: 'bg-slate-50 text-slate-300 border border-slate-200', dot: 'bg-slate-200' },
  not_required: { label: 'N/A', cls: 'bg-slate-100 text-slate-300', dot: 'bg-slate-200' },
};

/**
 * TrainingStaffCardGrid — staff-card grid with per-staff training categories.
 *
 * Features:
 *  - Category filter pills (filter by assigned category)
 *  - Checkbox multi-select with bulk assign/remove action bar
 *  - Per-card "Categories" button (opens StaffCategoryPopup)
 *  - "Manage Categories" button next to team dropdown (opens BulkCategoryModal)
 *  - StaffTrainingDrawer with "Assigned Categories" toggle section
 */
export default function TrainingStaffCardGrid({ staff, teams, compliance, bookings, courses, requirements, getQualStatus, onBookTraining }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [searchByType, setSearchByType] = useState({ direct_employee: '', subcontractor: '', agency: '' });
  const [teamFilter, setTeamFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAddCompleted, setShowAddCompleted] = useState(null);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [categoryPopupStaff, setCategoryPopupStaff] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);

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

  // Team filter + category filter
  const filteredStaff = useMemo(() => staff.filter(m =>
    (teamFilter === 'all' || m.team_id === teamFilter) && m.is_active !== false
  ), [staff, teamFilter]);

  const categoryFiltered = useMemo(() => {
    if (activeCategoryFilters.length === 0) return filteredStaff;
    return filteredStaff.filter(m => {
      const ids = m.training_category_ids || [];
      return activeCategoryFilters.some(reqId => ids.includes(reqId));
    });
  }, [filteredStaff, activeCategoryFilters]);

  const staffWithStats = useMemo(() => categoryFiltered.map(m => {
    const assignedCats = categories.filter(c => (m.training_category_ids || []).includes(c.id));
    const gapCount = assignedCats.filter(c => {
      const st = getQualStatus(m, c.qualification_type);
      return st === 'gap' || st === 'expired';
    }).length;
    const expiringCount = assignedCats.filter(c => getQualStatus(m, c.qualification_type) === 'expiring').length;
    const bookedCount = assignedCats.filter(c => getQualStatus(m, c.qualification_type) === 'booked').length;
    return { member: m, gapCount, expiringCount, bookedCount, assignedCount: assignedCats.length, isFullyQualified: gapCount === 0 && expiringCount === 0 };
  }), [categoryFiltered, categories, getQualStatus]);

  const stats = useMemo(() => {
    let gaps = 0, expiring = 0, booked = 0, noCats = 0;
    staffWithStats.forEach(s => {
      if (s.gapCount > 0) gaps++;
      if (s.expiringCount > 0) expiring++;
      if (s.bookedCount > 0) booked++;
      if (s.assignedCount === 0) noCats++;
    });
    return {
      total: staffWithStats.length,
      qualified: staffWithStats.filter(s => s.isFullyQualified && s.assignedCount > 0).length,
      gaps, expiring, booked, noCats,
    };
  }, [staffWithStats]);

  // Group by worker type, then apply each section's own search query
  const sections = useMemo(() => {
    const groups = { direct_employee: [], subcontractor: [], agency: [] };
    staffWithStats.forEach(s => {
      const wt = s.member.worker_type;
      if (groups[wt]) groups[wt].push(s);
    });
    const filterBySearch = (list, q) => {
      if (!q) return list;
      const lc = q.toLowerCase();
      return list.filter(s => s.member.name.toLowerCase().includes(lc) || (s.member.email || '').toLowerCase().includes(lc));
    };
    return [
      { type: 'direct_employee', label: 'Direct Employees', icon: Users, headerCls: 'from-[#2E5A1A] to-[#5A8C1E]', items: filterBySearch(groups.direct_employee, searchByType.direct_employee) },
      { type: 'subcontractor', label: 'Subcontractors', icon: HardHat, headerCls: 'from-amber-500 to-orange-500', items: filterBySearch(groups.subcontractor, searchByType.subcontractor) },
      { type: 'agency', label: 'Agency Staff', icon: Briefcase, headerCls: 'from-blue-500 to-indigo-600', items: filterBySearch(groups.agency, searchByType.agency) },
    ];
  }, [staffWithStats, searchByType]);

  // Checkbox helpers
  const toggleStaffSelect = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSectionSelectAll = (sectionItems) => {
    const allSelected = sectionItems.every(s => selectedStaffIds.includes(s.member.id));
    if (allSelected) {
      const ids = sectionItems.map(s => s.member.id);
      setSelectedStaffIds(prev => prev.filter(x => !ids.includes(x)));
    } else {
      const ids = sectionItems.map(s => s.member.id);
      setSelectedStaffIds(prev => [...new Set([...prev, ...ids])]);
    }
  };
  const clearSelection = () => setSelectedStaffIds([]);

  const toggleCategoryFilter = (reqId) => {
    setActiveCategoryFilters(prev => prev.includes(reqId) ? prev.filter(x => x !== reqId) : [...prev, reqId]);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['staff'] });
    qc.invalidateQueries({ queryKey: ['staff-page-hub'] });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Users} label="Total Crew" value={stats.total} gradient="stat-gradient-brand" />
        <StatTile icon={CheckCircle2} label="Fully Qualified" value={stats.qualified} gradient="stat-gradient-emerald" />
        <StatTile icon={AlertTriangle} label="Training Gaps" value={stats.gaps} gradient="stat-gradient-rose" />
        <StatTile icon={Layers} label="No Categories" value={stats.noCats} gradient="stat-gradient-slate" />
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">Filter:</span>
          {activeCategoryFilters.length > 0 && (
            <button
              onClick={() => setActiveCategoryFilters([])}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200 transition flex-shrink-0"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          {categories.map(cat => {
            const active = activeCategoryFilters.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategoryFilter(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition flex-shrink-0 ${
                  active
                    ? 'bg-[#2E5A1A] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2E5A1A] hover:text-[#2E5A1A]'
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                {cat.short_code}
                <span className="font-normal opacity-70 hidden sm:inline">{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Team filter + Manage Categories button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/10 focus:border-[#2E5A1A]">
          <option value="all">All Crews</option>
          {teams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
        </select>
        <button
          onClick={() => setBulkModal({ mode: 'manage' })}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0"
        >
          <Tag className="w-4 h-4" /> Manage Categories
        </button>
      </div>

      {/* Three worker-type sections, each with its own header + search */}
      {sections.map(section => {
        if (section.items.length === 0) return null;
        const SectionIcon = section.icon;
        const allSectionSelected = section.items.length > 0 && section.items.every(s => selectedStaffIds.includes(s.member.id));
        return (
          <div key={section.type} className="space-y-3">
            <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r ${section.headerCls} px-4 py-3 shadow-sm`}>
              <button
                onClick={() => toggleSectionSelectAll(section.items)}
                className="w-6 h-6 rounded-md bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition"
                title={allSectionSelected ? 'Deselect all' : 'Select all'}
              >
                {allSectionSelected && <Check className="w-4 h-4 text-white" />}
              </button>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <SectionIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-white">{section.label}</h3>
              <span className="text-xs font-bold text-white/80 bg-white/15 px-2 py-0.5 rounded-full">{section.items.length}</span>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  value={searchByType[section.type]}
                  onChange={e => setSearchByType(prev => ({ ...prev, [section.type]: e.target.value }))}
                  placeholder={`Search ${section.label.toLowerCase()}…`}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/15 border border-white/20 text-white text-sm placeholder-white/60 focus:outline-none focus:bg-white/25 focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {section.items.map(({ member: m, gapCount, expiringCount, bookedCount, assignedCount, isFullyQualified }) => (
                <StaffCard
                  key={m.id}
                  m={m}
                  teamName={teamName}
                  categories={categories}
                  getQualStatus={getQualStatus}
                  compliance={compliance}
                  bookedCount={bookedCount}
                  isFullyQualified={isFullyQualified}
                  gapCount={gapCount}
                  expiringCount={expiringCount}
                  assignedCount={assignedCount}
                  selected={selectedStaffIds.includes(m.id)}
                  onToggleSelect={() => toggleStaffSelect(m.id)}
                  onClick={() => setSelectedStaff(m)}
                  onOpenCategories={() => setCategoryPopupStaff(m)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {staffWithStats.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-8 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No staff match the current filters.</p>
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selectedStaffIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl">
          <span className="text-sm font-bold">{selectedStaffIds.length} selected</span>
          <div className="w-px h-6 bg-white/20" />
          <button
            onClick={() => setBulkModal({ mode: 'assign', staffIds: selectedStaffIds })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition"
          >
            <Plus className="w-3.5 h-3.5" /> Assign Categories
          </button>
          <button
            onClick={() => setBulkModal({ mode: 'remove', staffIds: selectedStaffIds })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
          >
            <X className="w-3.5 h-3.5" /> Remove Categories
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs font-semibold hover:bg-white/20 transition"
          >
            Clear
          </button>
        </div>
      )}

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
          onCategoriesChanged={refresh}
        />
      )}
      {showAddCompleted && (
        <AddCompletedTrainingModal
          staffId={showAddCompleted.id}
          staffName={showAddCompleted.name}
          onClose={() => setShowAddCompleted(null)}
        />
      )}
      {categoryPopupStaff && (
        <StaffCategoryPopup
          staff={categoryPopupStaff}
          categories={categories}
          onClose={() => setCategoryPopupStaff(null)}
        />
      )}
      {bulkModal && (
        <BulkCategoryModal
          preselectedStaffIds={bulkModal.mode === 'manage' ? null : bulkModal.staffIds}
          staff={staff}
          categories={categories}
          onClose={() => setBulkModal(null)}
        />
      )}
    </div>
  );
}

function StaffCard({ m, teamName, categories, getQualStatus, compliance, bookedCount, isFullyQualified, gapCount, expiringCount, assignedCount, selected, onToggleSelect, onClick, onOpenCategories }) {
  const assignedCategories = categories.filter(c => (m.training_category_ids || []).includes(c.id));

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 relative overflow-hidden transition group ${
      selected ? 'border-[#2E5A1A] ring-2 ring-[#2E5A1A]/20' : 'border-slate-200/70 hover:shadow-md hover:border-[#2E5A1A]/30'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
            selected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 hover:border-[#2E5A1A]'
          }`}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </button>
        <button onClick={onClick} type="button" className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{m.name.charAt(0)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{teamName(m.team_id)}</p>
          </div>
        </button>
        <div className="flex-shrink-0">
          {assignedCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
              <Layers className="w-3 h-3" /> No cats
            </span>
          ) : isFullyQualified ? (
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

      {/* Only show assigned categories as chips */}
      <button onClick={onClick} type="button" className="w-full text-left">
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {assignedCategories.length === 0 ? (
            <span className="text-[11px] text-slate-300 italic">No categories assigned — use the Categories button to add</span>
          ) : (
            assignedCategories.map(cat => {
              const st = getQualStatus(m, cat.qualification_type);
              const meta = STATUS_META[st] || STATUS_META.not_assigned;
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
            })
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        {bookedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600">
            <Calendar className="w-3 h-3" /> {bookedCount} booked
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenCategories(); }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#2E5A1A] hover:text-white text-slate-600 text-[11px] font-semibold transition"
          title="Manage training categories"
        >
          <Tag className="w-3.5 h-3.5" /> Categories
        </button>
        <button
          onClick={onClick}
          className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#2E5A1A]"
        >
          View <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * StaffTrainingDrawer — slide-in drawer with Assigned Categories section
 * + qualifications list (only assigned categories).
 */
function StaffTrainingDrawer({ staff, teams, categories, compliance, bookings, courses, getQualStatus, onClose, onBookTraining, onOpenProfile, onAddCompleted, onCategoriesChanged }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingQual, setEditingQual] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [catSaving, setCatSaving] = useState(false);

  const teamName = (id) => {
    const t = teams.find(t => t.id === id);
    return t ? t.name : '—';
  };

  const assignedCategoryIds = staff.training_category_ids || [];
  const assignedCategories = categories.filter(c => assignedCategoryIds.includes(c.id));

  const myBookings = bookings.filter(b => b.staff_id === staff.id && b.status === 'booked');
  const myCompletedBookings = bookings.filter(b => b.staff_id === staff.id && (b.status === 'passed' || b.status === 'attended' || b.status === 'failed'));

  const findLinkedBooking = (complianceItem) => {
    if (!complianceItem) return null;
    return myCompletedBookings.find(b =>
      b.issue_date === complianceItem.issue_date &&
      (b.certificate_title === complianceItem.title || b.certificate_url === complianceItem.document_url)
    ) || myCompletedBookings.find(b => b.issue_date === complianceItem.issue_date) || null;
  };

  const gapCategories = assignedCategories.filter(c => {
    const st = getQualStatus(staff, c.qualification_type);
    return st === 'gap' || st === 'expired' || st === 'expiring';
  });

  const toggleCategory = async (reqId) => {
    setCatSaving(true);
    const next = assignedCategoryIds.includes(reqId)
      ? assignedCategoryIds.filter(id => id !== reqId)
      : [...assignedCategoryIds, reqId];
    try {
      await base44.entities.Staff.update(staff.id, { training_category_ids: next });
      staff.training_category_ids = next; // optimistic update
      qc.invalidateQueries({ queryKey: ['staff'] });
      onCategoriesChanged();
    } catch (e) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally {
      setCatSaving(false);
    }
  };

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

          {/* Assigned Categories — toggle chips */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Assigned Categories
              {catSaving && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            </h4>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const active = assignedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    disabled={catSaving}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
                      active
                        ? 'bg-[#2E5A1A] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {cat.short_code}
                    <span className="font-normal opacity-70">{cat.label}</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-slate-400">No training categories defined.</p>
              )}
            </div>
          </div>

          {/* Qualifications — only assigned categories */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Qualifications</h4>
            <div className="space-y-1.5">
              {assignedCategories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                  No categories assigned. Use the toggles above to add training categories.
                </p>
              ) : (
                assignedCategories.map(cat => {
                  const st = getQualStatus(staff, cat.qualification_type);
                  const meta = STATUS_META[st] || STATUS_META.not_assigned;
                  const items = compliance.filter(c =>
                    (c.reference_id === staff.id || c.reference_name === staff.name) &&
                    c.qualification_type === cat.qualification_type
                  );
                  const latest = items[0];
                  const expiry = latest?.expiry_date;
                  const days = expiry ? complianceDaysUntil(expiry) : null;
                  if (editingQual?.catId === cat.id && latest) {
                    return (
                      <EditTrainingInlineForm
                        key={cat.id}
                        complianceItem={latest}
                        booking={findLinkedBooking(latest)}
                        category={cat}
                        staffId={staff.id}
                        staffName={staff.name}
                        onDone={() => setEditingQual(null)}
                      />
                    );
                  }
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
                      {latest && (
                        <button onClick={() => setEditingQual({ catId: cat.id })}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {(st === 'gap' || st === 'expired' || st === 'expiring') && (
                        <button onClick={() => onBookTraining([staff.id], cat.qualification_type)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-[#2E5A1A] text-white hover:bg-[#1c4a12] transition">
                          <UserPlus className="w-3 h-3" /> Book
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {myBookings.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Booked Courses</h4>
              <div className="space-y-1.5">
                {myBookings.map(b => {
                  const course = courses.find(c => c.id === b.course_id);
                  if (editingBooking === b.id) {
                    return (
                      <EditTrainingInlineForm
                        key={b.id}
                        complianceItem={null}
                        booking={b}
                        category={null}
                        staffId={staff.id}
                        staffName={staff.name}
                        onDone={() => setEditingBooking(null)}
                      />
                    );
                  }
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
                      <button onClick={() => setEditingBooking(b.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
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