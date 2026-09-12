import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Briefcase, MapPin, Loader2, X, ChevronDown, ChevronRight,
  Search, Layers, Plus, CheckCircle2, Users, Calendar,
} from 'lucide-react';
import { startOfWeek, format, addDays } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { getJobPrimaryType } from '@/utils/jobTeams';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * Quick-Assign Job Pool — mobile-first, organised by discipline.
 *
 * Jobs are grouped into collapsible discipline sections (Drilling, Groundworks,
 * Enabling, etc.) so the manager sees a tidy, scannable list instead of one
 * long scroll. Selecting a job opens a clean assign panel where you can pick
 * MULTIPLE staff at once (tap chips to toggle), choose a day, and assign them
 * all in one tap. Rapid mode keeps the panel open for fast multi-job booking.
 *
 * Only active jobs (planning / in_progress) are ever shown — completed or
 * cancelled work is filtered out at the query level.
 */

const DISCIPLINE_META = {
  drilling: { label: 'Drilling', color: 'amber', dot: 'bg-amber-500', header: 'bg-amber-50 text-amber-800', ring: 'ring-amber-200' },
  cp_drilling: { label: 'CP Drilling', color: 'amber', dot: 'bg-amber-500', header: 'bg-amber-50 text-amber-800', ring: 'ring-amber-200' },
  rotary_drilling: { label: 'Rotary Drilling', color: 'blue', dot: 'bg-blue-500', header: 'bg-blue-50 text-blue-800', ring: 'ring-blue-200' },
  groundworks: { label: 'Groundworks', color: 'emerald', dot: 'bg-emerald-500', header: 'bg-emerald-50 text-emerald-800', ring: 'ring-emerald-200' },
  coring: { label: 'Coring', color: 'teal', dot: 'bg-teal-500', header: 'bg-teal-50 text-teal-800', ring: 'ring-teal-200' },
  trial_pit: { label: 'Trial Pit', color: 'lime', dot: 'bg-lime-500', header: 'bg-lime-50 text-lime-800', ring: 'ring-lime-200' },
  enabling_works: { label: 'Enabling Works', color: 'purple', dot: 'bg-purple-500', header: 'bg-purple-50 text-purple-800', ring: 'ring-purple-200' },
  depot: { label: 'Depot', color: 'slate', dot: 'bg-slate-400', header: 'bg-slate-50 text-slate-700', ring: 'ring-slate-200' },
  supervisor: { label: 'Supervision', color: 'indigo', dot: 'bg-indigo-500', header: 'bg-indigo-50 text-indigo-800', ring: 'ring-indigo-200' },
};
const DEFAULT_META = { label: 'General', color: 'slate', dot: 'bg-slate-400', header: 'bg-slate-50 text-slate-700', ring: 'ring-slate-200' };

export default function RotaJobPool({ weekStart, embedded = false }) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningJob, setAssigningJob] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState([]); // multi-select array
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [rapidMode, setRapidMode] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeDivisionId } = useDivision();

  const ws = weekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const days = Array.from({ length: 5 }, (_, i) => format(addDays(new Date(ws), i), 'yyyy-MM-dd'));

  // Only active jobs — completed/cancelled work is never shown
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['rota-pool-jobs'],
    queryFn: async () => {
      const r = await base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress'] } }, 'name', 50);
      return r.data || r || [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['rota-pool-staff'],
    queryFn: async () => {
      const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 200);
      return r.data || r || [];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  // All assignments for this week — used to show existing coverage per job/day
  const { data: allRotas = [] } = useQuery({
    queryKey: ['rotas', ws, activeDivisionId || 'overview'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDivisionScopedData', { entity: 'RotaAssignment', division_id: activeDivisionId, filter: { week_start: ws } });
      const all = res.data?.data || [];
      return all.filter(a => !a.assignment_type || a.assignment_type === 'job');
    },
  });

  // Group jobs by discipline
  const groupedJobs = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = jobs.filter(j => {
      if (!q) return true;
      return (j.name || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q);
    });
    const groups = {};
    filtered.forEach(job => {
      const type = getJobPrimaryType(job, teams) || 'general';
      if (!groups[type]) groups[type] = [];
      groups[type].push(job);
    });
    return groups;
  }, [jobs, teams, search]);

  const groupKeys = Object.keys(groupedJobs).sort((a, b) => {
    // Put drilling types first, then alphabetical
    const order = ['drilling', 'cp_drilling', 'rotary_drilling', 'groundworks', 'coring', 'trial_pit', 'enabling_works', 'supervisor', 'depot', 'general'];
    return order.indexOf(a) - order.indexOf(b);
  });

  // Existing assignments for the currently selected staff+date (across all selected staff)
  const existingForSelection = useMemo(() => {
    if (selectedStaff.length === 0 || !selectedDate) return [];
    return allRotas.filter(r => selectedStaff.includes(r.staff_id) && r.assigned_date === selectedDate);
  }, [allRotas, selectedStaff, selectedDate]);

  // Count how many staff are already on this job for the selected date
  const assignedCountForJob = (jobId, dateStr) => {
    if (!dateStr) return 0;
    return allRotas.filter(r => r.job_id === jobId && r.assigned_date === dateStr).length;
  };

  const filteredStaff = staff.filter(s => {
    if (!staffSearch) return true;
    return (s.name || '').toLowerCase().includes(staffSearch.toLowerCase());
  });

  const toggleStaff = (id) => {
    setSelectedStaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!assigningJob || selectedStaff.length === 0 || !selectedDate) return;
    setSaving(true);
    try {
      // Create one assignment per selected staff member
      const created = await base44.entities.RotaAssignment.bulkCreate(
        selectedStaff.map(sid => ({
          staff_id: sid,
          job_id: assigningJob.id,
          assigned_date: selectedDate,
          week_start: ws,
          assignment_type: 'job',
          status: 'assigned',
          division_id: activeDivisionId || null,
        }))
      );
      await queryClient.invalidateQueries({ queryKey: ['rotas'] });
      await queryClient.invalidateQueries({ queryKey: ['rota-assignments-dnd'] });
      const names = selectedStaff.map(id => staff.find(s => s.id === id)?.name).filter(Boolean);
      const summary = names.length === 1 ? names[0] : `${names.length} crew`;
      toast({
        title: `${selectedStaff.length} ${selectedStaff.length === 1 ? 'person' : 'people'} assigned`,
        description: `${summary} → ${assigningJob.name} on ${format(new Date(selectedDate), 'EEE dd MMM')}`,
      });
      if (rapidMode) {
        // Keep the job + date, clear staff so the manager can pick the next crew
        setSelectedStaff([]);
        setStaffSearch('');
      } else {
        setAssigningJob(null);
        setSelectedStaff([]);
        setSelectedDate('');
        setStaffSearch('');
      }
    } catch (err) {
      toast({ title: 'Assignment failed', description: err.message || 'Could not create assignment.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalActiveJobs = jobs.length;

  return (
    <div className={embedded ? "" : "hub-glass rounded-2xl overflow-hidden"}>
      {/* Header — collapsible (hidden when embedded in a modal) */}
      {!embedded && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-sm block leading-tight text-slate-900">Quick Assign</span>
              <span className="text-[11px] text-slate-400">{totalActiveJobs} active jobs · tap to assign</span>
            </div>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
      )}

      {expanded && (
        <div className="p-3 sm:p-4">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs by name or location..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
            />
          </div>

          {/* Rapid multi-assign toggle */}
          <button
            onClick={() => setRapidMode(v => !v)}
            className={`w-full mb-3 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              rapidMode ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" /> Multi-Job Mode
            </span>
            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">Keep panel open after assigning</span>
            <span className={`relative w-8 h-4 rounded-full transition ${rapidMode ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${rapidMode ? 'left-4' : 'left-0.5'}`} />
            </span>
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : totalActiveJobs === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No active jobs to assign</p>
              <p className="text-xs text-slate-400 mt-1">Completed jobs are hidden automatically</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupKeys.map(key => {
                const meta = DISCIPLINE_META[key] || DEFAULT_META;
                const groupJobs = groupedJobs[key];
                const isCollapsed = collapsedGroups[key];
                return (
                  <div key={key} className="rounded-xl border border-slate-200 overflow-hidden">
                    {/* Discipline header */}
                    <button
                      onClick={() => toggleGroup(key)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 ${meta.header} transition hover:opacity-80`}
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      <span className="text-sm font-bold">{meta.label}</span>
                      <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-white/60">{groupJobs.length}</span>
                    </button>

                    {/* Jobs in this discipline */}
                    {!isCollapsed && (
                      <div className="p-2 space-y-1.5 bg-white">
                        {groupJobs.map(job => {
                          const isSelected = assigningJob?.id === job.id;
                          const count = assignedCountForJob(job.id, selectedDate);
                          return (
                            <div key={job.id}>
                              <button
                                onClick={() => {
                                  if (isSelected) {
                                    setAssigningJob(null);
                                  } else {
                                    setAssigningJob(job);
                                    if (!selectedDate) setSelectedDate(days[0]);
                                  }
                                }}
                                className={`w-full text-left p-3 rounded-lg border transition ${
                                  isSelected
                                    ? 'border-primary bg-emerald-50 ring-1 ring-primary/20'
                                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-800 leading-tight">{job.name}</p>
                                  {count > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                                      {count} on
                                    </span>
                                  )}
                                </div>
                                {job.location && (
                                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" /> {job.location}
                                  </p>
                                )}
                              </button>

                              {/* Inline assign panel */}
                              {isSelected && (
                                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                  {/* Existing assignments warning */}
                                  {selectedStaff.length > 0 && selectedDate && existingForSelection.length > 0 && (
                                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                      <p className="text-[11px] font-bold text-amber-700 mb-1 flex items-center gap-1">
                                        <Layers className="w-3 h-3" /> {existingForSelection.length} already assigned on {format(new Date(selectedDate), 'EEE')}
                                      </p>
                                      <p className="text-[10px] text-amber-600">This will add as additional job{existingForSelection.length > 1 ? 's' : ''}.</p>
                                    </div>
                                  )}

                                  {/* Staff picker — multi-select chips with search */}
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                                      <Users className="w-3 h-3" /> Select Crew {selectedStaff.length > 0 && <span className="text-emerald-600">({selectedStaff.length})</span>}
                                    </label>
                                    <div className="relative mb-2">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                      <input
                                        value={staffSearch}
                                        onChange={e => setStaffSearch(e.target.value)}
                                        placeholder="Search crew..."
                                        className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-primary"
                                      />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                      {filteredStaff.map(s => {
                                        const isOn = selectedStaff.includes(s.id);
                                        return (
                                          <button
                                            key={s.id}
                                            onClick={() => toggleStaff(s.id)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition border ${
                                              isOn
                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                                            }`}
                                          >
                                            {isOn && <CheckCircle2 className="w-3 h-3" />}
                                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{s.name?.charAt(0) || '?'}</span>
                                            {s.name}
                                          </button>
                                        );
                                      })}
                                      {filteredStaff.length === 0 && (
                                        <p className="text-xs text-slate-400 py-2">No crew found</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Day selector — big tappable buttons */}
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                                      <Calendar className="w-3 h-3" /> Day
                                    </label>
                                    <div className="grid grid-cols-5 gap-1.5">
                                      {days.map(d => (
                                        <button
                                          key={d}
                                          onClick={() => setSelectedDate(d)}
                                          className={`py-2 text-xs font-semibold rounded-lg transition ${
                                            selectedDate === d
                                              ? 'bg-primary text-white shadow-sm'
                                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                          }`}
                                        >
                                          {format(new Date(d), 'EEE')}
                                          <span className="block text-[10px] font-normal opacity-70">{format(new Date(d), 'dd')}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleAssign}
                                      disabled={selectedStaff.length === 0 || !selectedDate || saving}
                                      className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
                                    >
                                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                      {rapidMode ? 'Add & Continue' : `Assign ${selectedStaff.length > 0 ? `(${selectedStaff.length})` : ''}`}
                                    </button>
                                    <button
                                      onClick={() => { setAssigningJob(null); setSelectedStaff([]); setSelectedDate(''); setStaffSearch(''); }}
                                      className="px-3 py-2.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}