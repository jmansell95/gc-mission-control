import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useToast } from '@/components/ui/use-toast';
import MarketDojoPill from './MarketDojoPill';
import AddressBookModal from './AddressBookModal';
import CrewEditorModal from './CrewEditorModal';
import {
  Plus, Search, X, Loader2, Building2, Briefcase,
  Wrench, UserCog, Trash2, Edit2, CheckCircle2, BookUser, Phone, HardHat,
} from 'lucide-react';

const SUB_TO_TYPE = {
  clients: { key: 'client', label: 'Clients', singular: 'Client', icon: Building2, color: '#059669', isStaff: false },
  contractors: { key: 'subcontractor', label: 'Subcontractors', singular: 'Subcontractor', icon: Wrench, color: '#2563eb', isStaff: true, showCrews: true },
  suppliers: { key: 'supplier', label: 'Suppliers', singular: 'Supplier', icon: Briefcase, color: '#d97706', isStaff: false },
  agency: { key: 'agency', label: 'Agency Workers', singular: 'Agency Worker', icon: UserCog, color: '#7c3aed', isStaff: true },
};

const emptyForm = {
  full_name: '', job_title: '', company: '', market_dojo_onboarded: false,
};

export default function ContactsTab({ activeSub }) {
  const meta = SUB_TO_TYPE[activeSub] || SUB_TO_TYPE.contractors;
  const isStaffType = meta.isStaff;
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [addressBook, setAddressBook] = useState(null);
  const [crewEditor, setCrewEditor] = useState(null);
  const { activeDivisionId } = useDivision();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['contacts-staff', meta.key],
    queryFn: () => base44.entities.Staff.filter({ worker_type: meta.key }, 'name', 500),
    enabled: isStaffType,
  });
  // Fetch all drilling crews (for crew counts on subcontractor cards)
  const { data: allCrews = [] } = useQuery({
    queryKey: ['drilling-crews-all'],
    queryFn: () => base44.entities.DrillingCrew.list('name', 500),
    enabled: meta.key === 'subcontractor',
  });
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['contacts-clients'],
    queryFn: () => base44.entities.Client.list(),
    enabled: meta.key === 'client',
  });
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['contacts-suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    enabled: meta.key === 'supplier',
  });

  const isLoading = isStaffType ? staffLoading : meta.key === 'client' ? clientsLoading : suppliersLoading;

  const records = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [];
    if (isStaffType) {
      // Filter out individual driller Staff records (crew_parent_id set) —
      // these are crew members managed via the CrewEditorModal, not standalone
      // contact entries. Only parent company records appear in the list.
      list = staff.filter(s => !s.crew_parent_id).map(s => ({
        id: s.id,
        full_name: s.name || '',
        job_title: s.job_title || '',
        company: s.company || '',
        onboarded: !!s.market_dojo_onboarded,
        crew_count: allCrews.filter(c => c.parent_staff_id === s.id).length,
        contacts: s.contacts || [],
        raw: s,
      }));
    } else if (meta.key === 'client') {
      list = clients.map(c => {
        const contact = (c.contacts && c.contacts[0]) || {};
        return {
          id: c.id,
          full_name: c.contact_name || contact.name || '',
          job_title: contact.role || '',
          company: c.name || '',
          onboarded: false,
          contacts: c.contacts || [],
          raw: c,
        };
      });
    } else {
      list = suppliers.map(s => {
        const contact = (s.contacts && s.contacts[0]) || {};
        return {
          id: s.id,
          full_name: s.contact_name || contact.name || '',
          job_title: contact.role || '',
          company: s.name || '',
          onboarded: false,
          contacts: s.contacts || [],
          raw: s,
        };
      });
    }
    if (q) {
      list = list.filter(r =>
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.job_title || '').toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [isStaffType, meta.key, staff, clients, suppliers, search]);

  const onboardedCount = isStaffType ? records.filter(r => r.onboarded).length : 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.full_name.trim() || !addForm.company.trim()) {
      toast({ title: 'Full name and company are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isStaffType) {
        await base44.entities.Staff.create({
          name: addForm.full_name.trim(),
          worker_type: meta.key,
          job_title: addForm.job_title.trim(),
          company: addForm.company.trim(),
          division_id: activeDivisionId || '',
          is_active: true,
          market_dojo_onboarded: !!addForm.market_dojo_onboarded,
          market_dojo_onboarded_at: addForm.market_dojo_onboarded ? new Date().toISOString() : null,
        });
        queryClient.invalidateQueries({ queryKey: ['contacts-staff', meta.key] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } else if (meta.key === 'client') {
        await base44.entities.Client.create({
          name: addForm.company.trim(),
          contact_name: addForm.full_name.trim(),
          contacts: [{ name: addForm.full_name.trim(), role: addForm.job_title.trim() }],
          division_id: activeDivisionId || '',
        });
        queryClient.invalidateQueries({ queryKey: ['contacts-clients'] });
      } else {
        await base44.entities.Supplier.create({
          name: addForm.company.trim(),
          contact_name: addForm.full_name.trim(),
          contacts: [{ name: addForm.full_name.trim(), role: addForm.job_title.trim() }],
          division_id: activeDivisionId || '',
        });
        queryClient.invalidateQueries({ queryKey: ['contacts-suppliers'] });
      }
      toast({ title: `${meta.singular} added` });
      setAddForm(emptyForm);
      setShowAdd(false);
    } catch (err) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (rec) => {
    setEditForm({
      kind: isStaffType ? 'staff' : meta.key,
      id: rec.id,
      full_name: rec.full_name,
      job_title: rec.job_title,
      company: rec.company,
      market_dojo_onboarded: rec.onboarded,
    });
    setEditing(rec);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editForm.kind === 'staff') {
        const wasOnboarded = editing.onboarded;
        const nowOnboarded = !!editForm.market_dojo_onboarded;
        const payload = {
          name: editForm.full_name.trim(),
          job_title: editForm.job_title.trim(),
          company: editForm.company.trim(),
          market_dojo_onboarded: nowOnboarded,
        };
        if (nowOnboarded && !wasOnboarded) payload.market_dojo_onboarded_at = new Date().toISOString();
        if (!nowOnboarded) payload.market_dojo_onboarded_at = null;
        await base44.entities.Staff.update(editForm.id, payload);
        queryClient.invalidateQueries({ queryKey: ['contacts-staff', meta.key] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } else if (editForm.kind === 'client') {
        await base44.entities.Client.update(editForm.id, {
          name: editForm.company.trim(),
          contact_name: editForm.full_name.trim(),
          contacts: [{ name: editForm.full_name.trim(), role: editForm.job_title.trim() }],
        });
        queryClient.invalidateQueries({ queryKey: ['contacts-clients'] });
      } else {
        await base44.entities.Supplier.update(editForm.id, {
          name: editForm.company.trim(),
          contact_name: editForm.full_name.trim(),
          contacts: [{ name: editForm.full_name.trim(), role: editForm.job_title.trim() }],
        });
        queryClient.invalidateQueries({ queryKey: ['contacts-suppliers'] });
      }
      toast({ title: 'Contact updated' });
      setEditing(null);
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec) => {
    if (!confirm(`Delete ${rec.full_name || rec.company}? This cannot be undone.`)) return;
    setDeletingId(rec.id);
    try {
      if (isStaffType) {
        await base44.entities.Staff.delete(rec.id);
        queryClient.invalidateQueries({ queryKey: ['contacts-staff', meta.key] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      } else if (meta.key === 'client') {
        await base44.entities.Client.delete(rec.id);
        queryClient.invalidateQueries({ queryKey: ['contacts-clients'] });
      } else {
        await base44.entities.Supplier.delete(rec.id);
        queryClient.invalidateQueries({ queryKey: ['contacts-suppliers'] });
      }
      toast({ title: 'Contact deleted' });
    } catch (err) {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const Icon = meta.icon;

  const crewBadge = (rec) => {
    if (meta.key !== 'subcontractor') return null;
    if (rec.crew_count > 0) {
      return (
        <span className="text-[10px] text-blue-700 font-medium truncate mt-0.5 inline-flex items-center gap-0.5">
          <HardHat className="w-3 h-3" /> {rec.crew_count} crew{rec.crew_count !== 1 ? 's' : ''}
        </span>
      );
    }
    return <span className="text-[10px] text-slate-400 truncate mt-0.5">No crews yet</span>;
  };

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="insight-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: meta.color }} /> {meta.label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isStaffType ? 'Creates staff records for rota assignment. Onboarding tracked via Market Dojo.' : 'Contact directory — not assignable to rotas.'}
            </p>
          </div>
          <button
            onClick={() => { setAddForm(emptyForm); setShowAdd(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-semibold shadow-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Add {meta.singular}
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role or company..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>
          {isStaffType && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> {onboardedCount} onboarded
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-semibold">
                <X className="w-3 h-3" /> {records.length - onboardedCount} pending
              </span>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white border border-slate-200 p-4 h-28" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="insight-card rounded-2xl p-10 text-center">
          <Icon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No {meta.label.toLowerCase()} yet. Click "Add {meta.singular}" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map(rec => (
            <div key={rec.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: meta.color }}>
                  {(rec.full_name || rec.company || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">{rec.full_name || '—'}</p>
                    {isStaffType && <MarketDojoPill onboarded={rec.onboarded} size="xs" />}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{rec.job_title || 'No job title'}</p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 flex-shrink-0" /> {rec.company || 'No company'}
                  </p>
                  {isStaffType && crewBadge(rec)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-50">
                <button
                  onClick={() => openEdit(rec)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-xs font-medium"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => setAddressBook({ type: isStaffType ? 'staff' : meta.key, id: rec.id, name: rec.full_name || rec.company, contacts: rec.contacts || [] })}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-[#2E5A1A] border border-[#2E5A1A]/20 rounded-lg hover:bg-[#2E5A1A]/5 transition text-xs font-medium"
                  title="Address book — manage multiple contacts"
                >
                  <BookUser className="w-3 h-3" /> Contacts
                </button>
                {meta.key === 'subcontractor' && (
                  <button
                    onClick={() => setCrewEditor({ staff: rec.raw, divisionId: rec.raw.division_id })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition text-xs font-medium"
                    title="Manage 2-man drilling crews"
                  >
                    <HardHat className="w-3 h-3" /> Crews
                  </button>
                )}
                <button
                  onClick={() => handleDelete(rec)}
                  disabled={deletingId === rec.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-xs font-medium disabled:opacity-50"
                >
                  {deletingId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                Add {meta.singular}
              </h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input type="text" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} autoFocus className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Job Title</label>
                <input type="text" value={addForm.job_title} onChange={e => setAddForm({ ...addForm, job_title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Company *</label>
                <input type="text" value={addForm.company} onChange={e => setAddForm({ ...addForm, company: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              {isStaffType && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
                  <input type="checkbox" checked={!!addForm.market_dojo_onboarded} onChange={e => setAddForm({ ...addForm, market_dojo_onboarded: e.target.checked })} className="w-4 h-4 mt-0.5 accent-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Onboarded in Market Dojo</p>
                    <p className="text-xs text-slate-500 mt-0.5">Tick once onboarding & compliance is completed in Market Dojo.</p>
                  </div>
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add {meta.singular}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#2E5A1A]" /> Edit {meta.singular}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-5 space-y-3">
              {isStaffType && (
                <div className="flex items-center justify-center pb-1">
                  <MarketDojoPill onboarded={editForm.market_dojo_onboarded} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input type="text" value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Job Title</label>
                <input type="text" value={editForm.job_title || ''} onChange={e => setEditForm({ ...editForm, job_title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
                <input type="text" value={editForm.company || ''} onChange={e => setEditForm({ ...editForm, company: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm" />
              </div>
              {isStaffType && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
                  <input type="checkbox" checked={!!editForm.market_dojo_onboarded} onChange={e => setEditForm({ ...editForm, market_dojo_onboarded: e.target.checked })} className="w-4 h-4 mt-0.5 accent-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Onboarded in Market Dojo</p>
                    <p className="text-xs text-slate-500 mt-0.5">Tick once onboarding & compliance is completed in Market Dojo.</p>
                  </div>
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address Book modal */}
      {addressBook && (
        <AddressBookModal
          open={!!addressBook}
          onClose={() => setAddressBook(null)}
          entityType={addressBook.type}
          recordId={addressBook.id}
          recordName={addressBook.name}
          initialContacts={addressBook.contacts}
        />
      )}

      {/* Crew Editor modal — subcontractor 2-man crews */}
      {crewEditor && (
        <CrewEditorModal
          open={!!crewEditor}
          onClose={() => setCrewEditor(null)}
          parentStaff={crewEditor.staff}
          parentDivisionId={crewEditor.divisionId}
        />
      )}
    </div>
  );
}