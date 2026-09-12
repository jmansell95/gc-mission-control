import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { X, Plus, Trash2, Edit2, Check, Loader2, BookUser, Mail, Phone } from 'lucide-react';

const emptyContact = { name: '', role: '', phone: '', email: '', notes: '' };

export default function AddressBookModal({ open, onClose, entityType, recordId, recordName, initialContacts }) {
  const [contacts, setContacts] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyContact);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState(emptyContact);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setContacts(Array.isArray(initialContacts) ? [...initialContacts] : []);
      setEditingIdx(null);
      setShowAdd(false);
      setAddDraft(emptyContact);
    }
  }, [open, initialContacts]);

  if (!open) return null;

  const entityApi = entityType === 'staff' ? base44.entities.Staff
    : entityType === 'client' ? base44.entities.Client
    : base44.entities.Supplier;

  const queryKey = entityType === 'staff' ? ['contacts-staff']
    : entityType === 'client' ? ['contacts-clients']
    : ['contacts-suppliers'];

  const persist = async (newContacts) => {
    setSaving(true);
    try {
      await entityApi.update(recordId, { contacts: newContacts });
      setContacts(newContacts);
      queryClient.invalidateQueries({ queryKey });
      if (entityType === 'staff') queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    if (!addDraft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    persist([...contacts, { ...addDraft, name: addDraft.name.trim() }]);
    setAddDraft(emptyContact);
    setShowAdd(false);
    toast({ title: 'Contact added' });
  };

  const handleSaveEdit = () => {
    if (!editDraft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const newContacts = [...contacts];
    newContacts[editingIdx] = { ...editDraft, name: editDraft.name.trim() };
    persist(newContacts);
    setEditingIdx(null);
    toast({ title: 'Contact updated' });
  };

  const handleDelete = (idx) => {
    if (!confirm('Delete this contact?')) return;
    persist(contacts.filter((_, i) => i !== idx));
    toast({ title: 'Contact deleted' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <BookUser className="w-4 h-4 text-primary" /> Address Book
            <span className="text-xs font-normal text-slate-400 truncate">· {recordName || ''}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {contacts.length === 0 && !showAdd && (
            <div className="text-center py-6">
              <BookUser className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No contacts yet. Click "Add Contact" to create one.</p>
            </div>
          )}

          {contacts.map((c, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-3">
              {editingIdx === idx ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Name *" value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                    <input type="text" placeholder="Job Title" value={editDraft.role} onChange={e => setEditDraft({ ...editDraft, role: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                    <input type="text" placeholder="Phone" value={editDraft.phone} onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                    <input type="email" placeholder="Email" value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <textarea placeholder="Notes" value={editDraft.notes} onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })} rows={2} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={saving} className="flex-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditingIdx(null)} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      {c.role && <p className="text-xs text-slate-500 truncate">{c.role}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingIdx(idx); setEditDraft({ ...emptyContact, ...c }); }} className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(idx)} disabled={saving} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {c.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" /> {c.phone}</p>}
                    {c.email && <p className="text-xs text-slate-500 flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {c.email}</p>}
                    {c.notes && <p className="text-xs text-slate-400 italic mt-1">{c.notes}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}

          {showAdd ? (
            <div className="rounded-lg border-2 border-dashed border-primary/30 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Name *" value={addDraft.name} onChange={e => setAddDraft({ ...addDraft, name: e.target.value })} autoFocus className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Job Title" value={addDraft.role} onChange={e => setAddDraft({ ...addDraft, role: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Phone" value={addDraft.phone} onChange={e => setAddDraft({ ...addDraft, phone: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                <input type="email" placeholder="Email" value={addDraft.email} onChange={e => setAddDraft({ ...addDraft, email: e.target.value })} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </div>
              <textarea placeholder="Notes" value={addDraft.notes} onChange={e => setAddDraft({ ...addDraft, notes: e.target.value })} rows={2} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving} className="flex-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Contact
                </button>
                <button onClick={() => { setShowAdd(false); setAddDraft(emptyContact); }} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:border-primary/30 hover:text-primary transition flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}