import React, { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Calendar, BookOpen, Building2, Settings, Sparkles, Plus, X, Edit2, Trash2, GripVertical,
  IdCard, Car, Award, CreditCard, FileText, ShieldCheck, GraduationCap,
} from 'lucide-react';
import { complianceDaysUntil } from '@/utils/complianceDate';
import TrainingStaffCardGrid from '@/components/training/TrainingStaffCardGrid';
import TrainingCalendar from '@/components/training/TrainingCalendar';
import AssignTrainingModal from '@/components/staff/AssignTrainingModal';
import TrainingProvidersTab from '@/components/staff/TrainingProvidersTab';
import BulkTrainingImportModal from '@/components/staff/BulkTrainingImportModal';
import TrainingManager from '@/components/TrainingManager';
import AutoBookerModal from '@/components/staff/AutoBookerModal';
import { ViewHeader, PRIMARY_BTN, SECONDARY_BTN } from '@/components/training/TrainingHubRail';
import SubPills from '@/components/SubPills';
import { CardGridSkeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';

const TRAINING_VIEWS = [
  { id: 'cards', label: 'Cards' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'courses', label: 'Courses' },
  { id: 'providers', label: 'Providers' },
];

const ICON_MAP = { IdCard, Car, Award, CreditCard, FileText, ShieldCheck, GraduationCap };

const DEFAULT_CATEGORIES = [
  { label: 'CSCS Card', short_code: 'CSCS', qualification_type: 'cscs_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 0, is_active: true },
  { label: 'CPCS Card', short_code: 'CPCS', qualification_type: 'cpcs_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 1, is_active: true },
  { label: 'NPORS Card', short_code: 'NPORS', qualification_type: 'npors_card', requires_front_back: true, is_card: true, icon: 'IdCard', sort_order: 2, is_active: true },
  { label: 'First Aid', short_code: 'FA', qualification_type: 'first_aid_cert', requires_front_back: false, is_card: false, icon: 'ShieldCheck', sort_order: 3, is_active: true },
  { label: 'Driver Licence', short_code: 'DRV', qualification_type: 'driver_license', requires_front_back: true, is_card: true, icon: 'Car', sort_order: 4, is_active: true },
  { label: 'DBS', short_code: 'DBS', qualification_type: 'dbs_certificate', requires_front_back: false, is_card: false, icon: 'FileText', sort_order: 5, is_active: true },
  { label: 'Forklift', short_code: 'FL', qualification_type: 'forklift', requires_front_back: false, is_card: false, icon: 'Award', sort_order: 6, is_active: true },
];

export default function TrainingMatrixHub() {
  const [view, setView] = useState('cards');
  const [showManage, setShowManage] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  return (
    <div className="space-y-4">
      <SubPills pills={TRAINING_VIEWS} active={view} onChange={setView} />
      <div className="min-w-0">
        {view === 'cards' && <CardsView onBulkImport={() => setShowBulkImport(true)} onManage={() => setShowManage(true)} />}
        {view === 'calendar' && <CalendarView onBulkImport={() => setShowBulkImport(true)} onManage={() => setShowManage(true)} />}
        {view === 'courses' && <TrainingManager onBulkImport={() => setShowBulkImport(true)} onManage={() => setShowManage(true)} />}
        {view === 'providers' && <TrainingProvidersTab onBulkImport={() => setShowBulkImport(true)} onManage={() => setShowManage(true)} />}
      </div>
      {showManage && <ManageCategoriesModal onClose={() => setShowManage(false)} />}
      {showBulkImport && <BulkTrainingImportModal onClose={() => setShowBulkImport(false)} />}
    </div>
  );
}

/** Shared data fetcher — used by CardsView and CalendarView. */
function useTrainingData() {
  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: compliance = [] } = useQuery({ queryKey: ['compliance-items-staff'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }) });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: courses = [] } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });
  const { data: requirements = [], isFetched: requirementsFetched } = useQuery({ queryKey: ['training-requirements'], queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100) });

  const queryClient = useQueryClient();
  const seedingRef = useRef(false);
  useEffect(() => {
    if (requirementsFetched && requirements.length === 0 && !seedingRef.current) {
      seedingRef.current = true;
      (async () => {
        try {
          await base44.entities.TrainingRequirement.bulkCreate(DEFAULT_CATEGORIES);
          queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
        } catch (e) { /* ignore */ }
      })();
    }
  }, [requirementsFetched, requirements.length]);

  const categories = useMemo(() => {
    const seen = new Set();
    return requirements
      .filter(r => r.is_active !== false)
      .filter(r => { if (seen.has(r.qualification_type)) return false; seen.add(r.qualification_type); return true; })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [requirements]);

  const courseCategoryMap = useMemo(() => {
    const m = {}; courses.forEach(c => { m[c.id] = c.category; }); return m;
  }, [courses]);

  // Aligned with the staff profile TrainingTab logic: a category is only
  // 'not_required' when the team HAS required qualifications AND this one
  // isn't in them. When the team has no required quals, every category shows
  // its real status — so a person with no training shows as gaps, not OK.
  const getQualStatus = (staffMember, qualType) => {
    const team = teams.find(t => t.id === staffMember.team_id);
    const required = team?.required_qualifications || [];
    if (required.length > 0 && !required.includes(qualType)) return 'not_required';
    const items = compliance.filter(c =>
      (c.reference_id === staffMember.id || c.reference_name === staffMember.name) &&
      c.qualification_type === qualType &&
      c.review_status !== 'rejected'
    );
    for (const item of items) {
      if (item.status_override === 'not_required') return 'not_required';
      if (item.status_override === 'missing') continue;
      // Pending-review documents don't count as valid yet
      if (item.review_status === 'pending_review') continue;
      const days = complianceDaysUntil(item.expiry_date);
      if (days === null) return 'valid';
      if (days < 0) continue;
      if (days <= 30) return 'expiring';
      return 'valid';
    }
    const hasBooking = bookings.some(b => b.staff_id === staffMember.id && b.status === 'booked' && courseCategoryMap[b.course_id] === qualType);
    if (hasBooking) return 'booked';
    return 'gap';
  };

  return { staff, teams, compliance, bookings, courses, requirements, categories, getQualStatus, isLoading };
}

function CardsView({ onBulkImport, onManage }) {
  const data = useTrainingData();
  const [showAssign, setShowAssign] = useState(false);
  const [showAutoBooker, setShowAutoBooker] = useState(false);
  const [assignPreselect, setAssignPreselect] = useState({ ids: [], category: null });

  if (data.isLoading) return <CardGridSkeleton count={4} />;

  const openAssign = (ids, category = null) => {
    setAssignPreselect({ ids, category });
    setShowAssign(true);
  };

  return (
    <div className="space-y-4">
      <ViewHeader icon={Users} title="Staff Cards" subtitle="Training compliance across your crews">
        <button onClick={() => openAssign([])} className={PRIMARY_BTN} type="button"><Users className="w-4 h-4" /> Assign Training</button>
        <button onClick={() => setShowAutoBooker(true)} className={SECONDARY_BTN} type="button"><Sparkles className="w-4 h-4" /> Auto-Booker</button>
        <button onClick={onBulkImport} className={SECONDARY_BTN} type="button"><Sparkles className="w-4 h-4" /> Bulk Import</button>
        <button onClick={onManage} className={SECONDARY_BTN} type="button"><Settings className="w-4 h-4" /> Categories</button>
      </ViewHeader>
      <TrainingStaffCardGrid
        staff={data.staff}
        teams={data.teams}
        compliance={data.compliance}
        bookings={data.bookings}
        courses={data.courses}
        requirements={data.requirements}
        getQualStatus={data.getQualStatus}
        onBookTraining={openAssign}
      />
      {showAssign && (
        <AssignTrainingModal
          preselectedStaffIds={assignPreselect.ids}
          preselectedCategory={assignPreselect.category}
          staff={data.staff}
          courses={data.courses}
          bookings={data.bookings}
          onClose={() => setShowAssign(false)}
        />
      )}
      {showAutoBooker && (
        <AutoBookerModal
          staff={data.staff}
          teams={data.teams}
          compliance={data.compliance}
          bookings={data.bookings}
          courses={data.courses}
          categories={data.categories}
          onClose={() => setShowAutoBooker(false)}
        />
      )}
    </div>
  );
}

function CalendarView({ onBulkImport, onManage }) {
  const data = useTrainingData();
  if (data.isLoading) return <CardGridSkeleton count={4} />;
  return (
    <div className="space-y-4">
      <ViewHeader icon={Calendar} title="Training Calendar" subtitle="Who's booked on what, and when">
        <button onClick={onBulkImport} className={SECONDARY_BTN} type="button"><Sparkles className="w-4 h-4" /> Bulk Import</button>
        <button onClick={onManage} className={SECONDARY_BTN} type="button"><Settings className="w-4 h-4" /> Categories</button>
      </ViewHeader>
      <TrainingCalendar courses={data.courses} bookings={data.bookings} staff={data.staff} teams={data.teams} />
    </div>
  );
}

/** Manage Categories Modal — restyled to Clean Kanban. */
function ManageCategoriesModal({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: requirements = [] } = useQuery({ queryKey: ['training-requirements'], queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100) });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: '', short_code: '', qualification_type: '', requires_front_back: false,
    is_card: false, icon: 'Award', sort_order: 0, is_active: true,
  });

  const sorted = [...requirements].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.short_code.trim() || !form.qualification_type.trim()) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, short_code: form.short_code.toUpperCase(), sort_order: parseInt(form.sort_order) || 0 };
      if (editingId) {
        await base44.entities.TrainingRequirement.update(editingId, payload);
        toast({ title: 'Training category updated' });
      } else {
        await base44.entities.TrainingRequirement.create(payload);
        toast({ title: 'Training category added' });
      }
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
      setForm({ label: '', short_code: '', qualification_type: '', requires_front_back: false, is_card: false, icon: 'Award', sort_order: requirements.length, is_active: true });
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (req) => {
    setForm({
      label: req.label || '', short_code: req.short_code || '', qualification_type: req.qualification_type || '',
      requires_front_back: !!req.requires_front_back, is_card: !!req.is_card, icon: req.icon || 'Award',
      sort_order: req.sort_order ?? requirements.length, is_active: req.is_active !== false,
    });
    setEditingId(req.id);
    setShowForm(true);
  };

  const handleDelete = async (req) => {
    if (!confirm(`Delete "${req.label}" from the training matrix?`)) return;
    try {
      await base44.entities.TrainingRequirement.delete(req.id);
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
      toast({ title: 'Category deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (req) => {
    try {
      await base44.entities.TrainingRequirement.update(req.id, { is_active: !req.is_active });
      queryClient.invalidateQueries({ queryKey: ['training-requirements'] });
    } catch (err) {
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    }
  };

  const inputClass = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Training Categories</h3>
              <p className="text-xs text-slate-500">Manage the columns in your training matrix</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 mb-4">
          {sorted.map(req => {
            const Icon = ICON_MAP[req.icon] || Award;
            return (
              <div key={req.id} className={'flex items-center gap-3 p-3 rounded-xl border transition ' + (req.is_active === false ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-slate-200 bg-white')}>
                <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (req.is_card ? 'bg-violet-50' : 'bg-emerald-50')}>
                  <Icon className={'w-4 h-4 ' + (req.is_card ? 'text-violet-600' : 'text-emerald-600')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{req.label}</p>
                  <p className="text-[10px] text-slate-400">{req.short_code} · {req.qualification_type}{req.is_card ? ' · Card type' : ''}</p>
                </div>
                <button onClick={() => handleEdit(req)} className="p-1.5 text-slate-400 hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleToggle(req)} className={'text-[10px] font-bold px-2 py-1 rounded-lg ' + (req.is_active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700')}>
                  {req.is_active === false ? 'Hidden' : 'Active'}
                </button>
                <button onClick={() => handleDelete(req)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm font-medium">No categories yet</p>
            </div>
          )}
        </div>
        <button onClick={() => { setEditingId(null); setForm({ label: '', short_code: '', qualification_type: '', requires_front_back: false, is_card: false, icon: 'Award', sort_order: requirements.length, is_active: true }); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#2E5A1A] hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition">
          <Plus className="w-4 h-4" /> Add Training Category
        </button>
        {showForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4" onClick={() => { setShowForm(false); setEditingId(null); }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-900">{editingId ? 'Edit Training Category' : 'New Training Category'}</p>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>Label *</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Confined Space" className={inputClass} /></div>
                  <div><label className={labelClass}>Short Code *</label><input value={form.short_code} onChange={e => setForm({ ...form, short_code: e.target.value.toUpperCase().slice(0, 4) })} placeholder="e.g. CS" className={inputClass} /></div>
                </div>
                <div><label className={labelClass}>Qualification Type Key *</label><input value={form.qualification_type} onChange={e => setForm({ ...form, qualification_type: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g. confined_space" className={inputClass} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>Icon</label><select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className={inputClass}><option value="Award">Award</option><option value="IdCard">ID Card</option><option value="Car">Car</option><option value="ShieldCheck">Shield</option><option value="CreditCard">Credit Card</option><option value="FileText">File</option><option value="GraduationCap">Graduation Cap</option></select></div>
                  <div><label className={labelClass}>Sort Order</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} className={inputClass} /></div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer"><input type="checkbox" checked={form.is_card} onChange={e => setForm({ ...form, is_card: e.target.checked, requires_front_back: e.target.checked ? true : form.requires_front_back })} className="w-4 h-4 accent-[#2E5A1A]" />Card type</label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer"><input type="checkbox" checked={form.requires_front_back} onChange={e => setForm({ ...form, requires_front_back: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />Front/back images</label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">{saving ? 'Saving…' : editingId ? 'Update' : 'Add Category'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}