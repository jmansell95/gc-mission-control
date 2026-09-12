import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Bookmark, Loader2, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Save-as-template modal — captures a name, optional description, and
 * shared/private toggle, then persists the current report config (category,
 * filters, chart selection) as a ReportTemplate owned by the current user.
 */
export default function ReportSaveModal({ filters, category, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      await base44.entities.ReportTemplate.create({
        name: name.trim(),
        description: description.trim(),
        category,
        filters: {
          datePreset: filters.datePreset || '',
          dateFrom: filters.dateFrom || '',
          dateTo: filters.dateTo || '',
          divisionId: filters.divisionId || '',
        },
        is_shared: isShared,
        owner_id: me?.id || '',
        owner_name: me?.full_name || me?.email || '',
      });
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast({ title: 'Template saved', description: `"${name}" added to My Reports.` });
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save template.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-primary flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Save as Template</h2>
              <p className="text-xs text-slate-500 capitalize">{category} report</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Template Name</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="e.g. Monthly Fleet Utilisation"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="What does this report show?"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none resize-none" />
          </div>

          <button onClick={() => setIsShared(!isShared)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 transition text-left">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isShared ? 'bg-emerald-100 text-primary' : 'bg-slate-100 text-slate-400'}`}>
              <Share2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Share with organisation</p>
              <p className="text-xs text-slate-500">{isShared ? 'Visible to all users' : 'Private to you only'}</p>
            </div>
            <div className={`w-10 h-6 rounded-full transition ${isShared ? 'bg-primary' : 'bg-slate-200'} relative`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${isShared ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
          </button>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />} Save Template
          </button>
        </div>
      </div>
    </div>
  );
}