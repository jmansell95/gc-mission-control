import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, Check, X, Loader2, UserPlus, Building2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import AccessSelect from './AccessSelect';
import { SelectItem } from '@/components/ui/select';

/**
 * AccessGroupStaffManager — embeds inside AccessGroupDetail.
 * Lists all staff assigned to the selected permission group, with inline
 * dropdowns to reassign them to a different group or division. Also supports
 * adding unassigned staff to this group.
 */
export default function AccessGroupStaffManager({ group, groups }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { divisions = [] } = useDivision();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');

  // Fetch ALL staff (high limit — covers all divisions)
  const { data: allStaff = [], isLoading } = useQuery({
    queryKey: ['staff-all-access'],
    queryFn: async () => (await base44.entities.Staff.list('-created_date', 5000)),
  });

  // Staff in THIS group (filtered by division if a division filter is selected)
  const groupStaff = useMemo(() => {
    return allStaff.filter(s => {
      if (s.permission_group_id !== group.id) return false;
      if (divisionFilter !== 'all' && s.division_id !== divisionFilter) return false;
      return true;
    });
  }, [allStaff, group.id, divisionFilter]);

  // Staff NOT in this group (for the add panel, also filtered by division)
  const availableStaff = useMemo(() => {
    const q = addSearch.toLowerCase().trim();
    return allStaff
      .filter(s => s.permission_group_id !== group.id)
      .filter(s => divisionFilter !== 'all' ? s.division_id === divisionFilter : true)
      .filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.job_title || '').toLowerCase().includes(q));
  }, [allStaff, group.id, addSearch, divisionFilter]);

  // Filtered group staff by search
  const filteredGroupStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groupStaff;
    return groupStaff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.job_title || '').toLowerCase().includes(q));
  }, [groupStaff, search]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['staff-all-access'] });
    qc.invalidateQueries({ queryKey: ['permission-groups'] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ staffId, fields }) => {
      await base44.entities.Staff.update(staffId, fields);
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const [selectedToAdd, setSelectedToAdd] = useState([]);

  const bulkAddMutation = useMutation({
    mutationFn: async (staffIds) => {
      const updates = staffIds.map(id => ({ id, permission_group_id: group.id }));
      await base44.entities.Staff.bulkUpdate(updates);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Staff added to group', description: `${selectedToAdd.length} staff assigned to ${group.name}` });
      setSelectedToAdd([]);
      setShowAdd(false);
      setAddSearch('');
    },
    onError: (e) => toast({ title: 'Failed to add staff', description: e.message, variant: 'destructive' }),
  });

  const handleGroupChange = (staffId, newGroupId) => {
    updateMutation.mutate({ staffId, fields: { permission_group_id: newGroupId || null } });
    toast({ title: 'Access level updated' });
  };

  const toggleAddSelect = (id) => {
    setSelectedToAdd(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="hub-glass rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">Staff in this Group</h3>
          <span className="text-xs font-bold text-slate-400">({groupStaff.length})</span>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setSelectedToAdd([]); setAddSearch(''); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 active:scale-95 transition shadow-sm"
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {showAdd ? 'Cancel' : 'Add Staff'}
        </button>
      </div>

      {/* Add staff panel */}
      {showAdd && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 animate-slide-up">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search staff to add to this group..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {availableStaff.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No staff found</p>
            ) : availableStaff.slice(0, 30).map(s => {
              const isSelected = selectedToAdd.includes(s.id);
              const currentGroup = groups.find(g => g.id === s.permission_group_id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleAddSelect(s.id)}
                  className={'w-full flex items-center gap-2 p-2 rounded-lg text-left transition ' +
                    (isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white')}
                >
                  <div className={'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ' +
                    (isSelected ? 'bg-primary border-primary' : 'border-slate-300')}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {currentGroup ? currentGroup.name : 'No group'} · {s.job_title || s.email || ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedToAdd.length > 0 && (
            <button
              onClick={() => bulkAddMutation.mutate(selectedToAdd)}
              disabled={bulkAddMutation.isPending}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 active:scale-95 disabled:opacity-50 transition"
            >
              {bulkAddMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Add {selectedToAdd.length} staff to {group.name}
            </button>
          )}
        </div>
      )}

      {/* Search + Division filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
        <select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white flex-shrink-0"
        >
          <option value="all">All Streams</option>
          {divisions.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : filteredGroupStaff.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-500">{groupStaff.length === 0 ? 'No staff in this group yet' : 'No matches'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{groupStaff.length === 0 ? 'Click "Add Staff" to assign people' : 'Try a different search'}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredGroupStaff.map(s => {
            const div = divisions.find(d => d.id === s.division_id);
            return (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: div ? `linear-gradient(135deg, ${div.color || '#2E5A1A'}, ${div.color || '#2E5A1A'}cc)` : '#e2e8f0', color: div ? 'white' : '#64748b' }}>
                  {(s.name || '?').charAt(0).toUpperCase()}
                </div>
                {/* Name + title */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.job_title || s.email || 'No title'}</p>
                </div>
                {/* Stream — read-only (inherited from the crew member's team) */}
                {div ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 flex-shrink-0" title="Inherited from the crew member's team — change the team to change the stream">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: div.color || '#2E5A1A' }} />
                    {div.name}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">No stream</span>
                )}
                {/* Group selector */}
                <AccessSelect
                  value={s.permission_group_id || ''}
                  onChange={(newId) => handleGroupChange(s.id, newId)}
                  placeholder="No group"
                >
                  <SelectItem value="__none">Remove from group</SelectItem>
                  {groups.filter(g => g.id !== group.id).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </AccessSelect>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}