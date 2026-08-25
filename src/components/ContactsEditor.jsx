import React from 'react';
import { UserPlus, Trash2, User, Mail, Phone, Briefcase } from 'lucide-react';

/**
 * Reusable editor for an unlimited contacts array (name, role, phone, email, notes).
 * No primary designation — flat list. Used by Client, Contractor & Supplier managers.
 *
 * @param {Array}  value    - contacts array
 * @param {Function} onChange - (newArray) => void
 * @param {string} label     - section label (default 'Contacts')
 */
export default function ContactsEditor({ value = [], onChange, label = 'Contacts' }) {
  const contacts = Array.isArray(value) ? value : [];

  const update = (idx, field, val) => {
    const next = contacts.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    onChange(next);
  };

  const add = () => {
    onChange([...contacts, { name: '', role: '', phone: '', email: '', notes: '' }]);
  };

  const remove = (idx) => {
    onChange(contacts.filter((_, i) => i !== idx));
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm';

  return (
    <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <User className="w-4 h-4 text-emerald-600" /> {label}
          <span className="text-xs text-slate-400 font-normal">· unlimited, no primary</span>
        </label>
        <button type="button" onClick={add}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition">
          <UserPlus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">No contacts added yet. Click "Add Contact" to add one.</p>
      ) : (
        <div className="space-y-3">
          {contacts.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Contact {idx + 1}</span>
                <button type="button" onClick={() => remove(idx)}
                  className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Name *</label>
                  <input type="text" value={c.name || ''} onChange={(e) => update(idx, 'name', e.target.value)} placeholder="Contact name"
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Role</label>
                  <input type="text" value={c.role || ''} onChange={(e) => update(idx, 'role', e.target.value)} placeholder="e.g. Project Manager"
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Phone</label>
                  <input type="tel" value={c.phone || ''} onChange={(e) => update(idx, 'phone', e.target.value)} placeholder="Phone number"
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={c.email || ''} onChange={(e) => update(idx, 'email', e.target.value)} placeholder="Email address"
                    className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Notes</label>
                  <input type="text" value={c.notes || ''} onChange={(e) => update(idx, 'notes', e.target.value)} placeholder="Optional notes"
                    className={inputCls} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}