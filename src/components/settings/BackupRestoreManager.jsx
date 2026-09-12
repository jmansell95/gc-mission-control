import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Download, Upload, RefreshCw, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Data Backup & Restore — lets admins export a snapshot of key entities
// to a downloadable JSON file, and restore by uploading a snapshot back.
// Also provides quick access to the existing seedDemoData and resetDatabase
// backend functions.

const BACKUP_ENTITIES = [
  'Job', 'Staff', 'RotaAssignment', 'Timesheet', 'Vehicle', 'Client',
  'Supplier', 'Contractor', 'JobCostItem', 'SiteAsset', 'PurchaseOrder',
  'Invoice', 'Team', 'Project', 'ToolboxTalk', 'SafetyReport',
];

export default function BackupRestoreManager() {
  const { toast } = useToast();
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('last-backup-date'));

  const handleBackup = async () => {
    setBacking(true);
    try {
      const snapshot = { _meta: { exported_at: new Date().toISOString(), version: '1.0' } };
      for (const entity of BACKUP_ENTITIES) {
        try {
          const res = await base44.entities[entity].list('-created_date', 500);
          snapshot[entity] = res.data || res || [];
        } catch { /* entity may not exist */ }
      }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem('last-backup-date', now);
      setLastBackup(now);
      toast({ title: '✓ Backup downloaded', description: `${Object.keys(snapshot).length - 1} entities exported.` });
    } catch (err) {
      toast({ title: 'Backup failed', description: err.message, variant: 'destructive' });
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      const entityNames = Object.keys(snapshot).filter(k => !k.startsWith('_'));
      let restored = 0;
      for (const entity of entityNames) {
        const records = snapshot[entity];
        if (!Array.isArray(records) || records.length === 0) continue;
        try {
          await base44.entities[entity]?.bulkCreate(records.map(r => {
            const { id, created_date, updated_date, created_by_id, ...data } = r;
            return data;
          }));
          restored += records.length;
        } catch { /* skip entities that don't exist */ }
      }
      toast({ title: '✓ Restore complete', description: `${restored} records imported from snapshot.` });
    } catch (err) {
      toast({ title: 'Restore failed', description: err.message, variant: 'destructive' });
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL data. This cannot be undone. Type DELETE to confirm.') === true) return;
    const confirmation = prompt('Type DELETE to confirm permanent data wipe:');
    if (confirmation !== 'DELETE') {
      toast({ title: 'Cancelled', description: 'Reset aborted — confirmation did not match.' });
      return;
    }
    try {
      await base44.functions.invoke('resetDatabase');
      toast({ title: '✓ Database reset', description: 'All data has been wiped.' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Database}
        title="Data Backup & Restore"
        description="Export a full data snapshot for disaster recovery or restore from a previous backup."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backup */}
        <div className="hub-glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg stat-gradient-blue flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Export Backup</p>
              <p className="text-xs text-slate-500">Download all data as a JSON snapshot</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Exports {BACKUP_ENTITIES.length} key entities (up to 500 records each) into a single downloadable JSON file.
            {lastBackup && <span className="block mt-1 text-emerald-600">Last backup: {new Date(lastBackup).toLocaleString('en-GB')}</span>}
          </p>
          <Button onClick={handleBackup} disabled={backing} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {backing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Exporting…</> : <><Download className="w-4 h-4 mr-1" /> Download Backup</>}
          </Button>
        </div>

        {/* Restore */}
        <div className="hub-glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg stat-gradient-emerald flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Restore from Backup</p>
              <p className="text-xs text-slate-500">Import data from a JSON snapshot</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Upload a previously exported backup file. Records are appended (not deduplicated) — use on a fresh database or after a reset.
          </p>
          <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition w-full ${
            restoring ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}>
            {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring…</> : <><Upload className="w-4 h-4" /> Choose Backup File</>}
            <input type="file" accept=".json" onChange={handleRestore} disabled={restoring} className="hidden" />
          </label>
        </div>

        {/* Reset */}
        <div className="hub-glass rounded-2xl p-5 border-rose-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg stat-gradient-rose flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-700">Danger Zone — Reset Database</p>
              <p className="text-xs text-slate-500">Permanently delete ALL data</p>
            </div>
          </div>
          <p className="text-xs text-rose-600 mb-3">
            ⚠️ This wipes every record from every entity. Requires typed confirmation. Cannot be undone.
          </p>
          <Button onClick={handleReset} variant="outline" className="w-full border-rose-300 text-rose-600 hover:bg-rose-50">
            <ShieldAlert className="w-4 h-4 mr-1" /> Reset Database
          </Button>
        </div>
      </div>
    </div>
  );
}