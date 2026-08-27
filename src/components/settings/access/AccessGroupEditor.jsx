import React, { useState } from 'react';
import { Shield, X, Save, Lock, KeyRound } from 'lucide-react';
import { normalizePermissions } from '@/utils/permissions';
import AccessModuleGrid from './AccessModuleGrid';

export default function AccessGroupEditor({ group, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    ...group,
    name: group.name || '',
    description: group.description || '',
    is_read_only: group.is_read_only || false,
    staff_type: group.staff_type || 'flexible',
    landing_page: group.landing_page || 'auto',
    permissions: normalizePermissions(group.permissions),
  }));

  const setLevel = (key, level) => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: level } }));
  const setAll = (level) => {
    const newPerms = {};
    Object.keys(form.permissions).forEach(k => { newPerms[k] = level; });
    setForm(f => ({ ...f, permissions: newPerms }));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 z-10 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
              <KeyRound className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{group.id ? 'Edit Access Group' : 'New Access Group'}</h2>
              <p className="text-[11px] text-slate-500">Applies across all divisions</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Group Name <span className="text-rose-500">*</span></label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                placeholder="e.g. Office Staff, Junior Manager, Read-Only Accounts"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                placeholder="What can members of this group do?"
              />
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={form.is_read_only}
                onChange={e => setForm({ ...form, is_read_only: e.target.checked })}
                className="w-4 h-4 rounded accent-[#2E5A1A] mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only Lockdown
                </span>
                <p className="text-xs text-slate-500 mt-0.5">Force every module to read-only — members can view but never create, edit, or delete anything.</p>
              </div>
            </label>
          </div>

          {/* Office / Field classification + landing page */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Staff Type</label>
              <p className="text-[11px] text-slate-400 mb-1.5">Classifies this group for filtering and the default landing page.</p>
              <div className="flex gap-1.5">
                {[
                  { v: 'office', label: 'Office' },
                  { v: 'field', label: 'Field' },
                  { v: 'flexible', label: 'Flexible' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, staff_type: opt.v }))}
                    className={'flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ' +
                      (form.staff_type === opt.v ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Landing Page</label>
              <p className="text-[11px] text-slate-400 mb-1.5">Where members land after login. 'auto' derives from staff type.</p>
              <select
                value={form.landing_page || 'auto'}
                onChange={e => setForm(f => ({ ...f, landing_page: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              >
                <option value="auto">Auto (from staff type)</option>
                <option value="/admin">Admin Dashboard (Office)</option>
                <option value="/staff-schedule">My Schedule (Field)</option>
                <option value="/staff-profile">My Profile</option>
                <option value="/deliveries">Delivery Dashboard</option>
                <option value="/scanner">Asset Scanner</option>
                <option value="/subcontractor">Subcontractor Portal</option>
              </select>
            </div>
          </div>

          {/* Module permissions */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Shield className="w-4 h-4 text-[#2E5A1A]" />
              <h3 className="text-sm font-bold text-slate-900">Module Permissions</h3>
            </div>
            <AccessModuleGrid
              permissions={form.permissions}
              isReadOnly={form.is_read_only}
              onChange={setLevel}
              onSetAll={setAll}
            />
          </div>
        </div>

        {/* Sticky actions */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Group'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}