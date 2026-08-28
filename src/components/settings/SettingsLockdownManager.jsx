import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Unlock, Search, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { settingsGroups } from '@/components/SettingsNav';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'management', label: 'Management', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'user', label: 'User', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'read_only', label: 'Read Only', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

export default function SettingsLockdownManager({ profile }) {
  const { lockdownMap, toggleLock, isLoading } = useSettingsAccess();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);

  const allItems = useMemo(() => settingsGroups.flatMap(g => g.items), []);

  const q = query.toLowerCase().trim();
  const filteredGroups = q
    ? settingsGroups
        .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) }))
        .filter(g => g.items.length > 0)
    : settingsGroups;

  const lockedCount = Object.values(lockdownMap).filter(v => v?.locked).length;
  const totalCount = allItems.length;

  const handleToggle = async (item, locked, allowedRoles) => {
    setSavingId(item.id);
    try {
      await toggleLock(item.id, locked, allowedRoles, profile?.name || profile?.email || 'Admin');
      toast({ title: locked ? `${item.label} locked` : `${item.label} unlocked` });
    } catch (e) {
      toast({ title: 'Failed to update lockdown', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const toggleRole = (itemId, currentRoles, role, item) => {
    const has = currentRoles.includes(role);
    const newRoles = has ? currentRoles.filter(r => r !== role) : [...currentRoles, role];
    if (newRoles.length === 0) {
      toast({ title: 'At least one role must be selected', variant: 'destructive' });
      return;
    }
    handleToggle(item, true, newRoles);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl mesh-bg shadow-xl">
        <div className="relative z-10 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Settings Lockdown</h2>
              <p className="text-emerald-50/90 text-sm">Restrict access to individual settings pages — lock sensitive areas to specific roles.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-200" />
                <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wide">Total Pages</p>
              </div>
              <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">{totalCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-200" />
                <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wide">Locked</p>
              </div>
              <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">{lockedCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
              <div className="flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5 text-emerald-200" />
                <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wide">Open</p>
              </div>
              <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">{totalCount - lockedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50/60 border border-blue-200 rounded-xl px-4 py-3">
        <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold">How lockdown works</p>
          <p className="text-blue-600/80 mt-0.5">Locking a page restricts access to only the selected roles. Super Admins always bypass every lock. Unlocked pages use the default role-based access already configured on each page.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search settings pages..."
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white" />
      </div>

      {/* Grouped lockdown grid */}
      {filteredGroups.map(group => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{group.label}</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{group.items.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(item => {
              const config = lockdownMap[item.id];
              const isLocked = config?.locked === true;
              const allowedRoles = config?.allowedRoles || ['admin'];
              const Icon = item.icon;
              const isSaving = savingId === item.id;
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`insight-card relative rounded-xl p-4 overflow-hidden ${isLocked ? 'ring-2 ring-amber-300' : ''}`}>
                  {isLocked && <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isLocked ? 'bg-amber-100' : 'bg-slate-100'}`}>
                        <Icon className={`w-4 h-4 ${isLocked ? 'text-amber-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.label}</p>
                          {isLocked && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" /> LOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                      <Switch checked={isLocked} onCheckedChange={(checked) => handleToggle(item, checked, allowedRoles)} />
                    </div>
                  </div>

                  {/* Role selector — only when locked */}
                  {isLocked && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Allowed Roles
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ROLE_OPTIONS.map(r => {
                          const active = allowedRoles.includes(r.value);
                          return (
                            <button key={r.value} type="button" disabled={isSaving}
                              onClick={() => toggleRole(item.id, allowedRoles, r.value, item)}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                                active
                                  ? r.color
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                              } ${isSaving ? 'opacity-50' : ''}`}>
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
                      {config?.lockedBy && (
                        <p className="text-[10px] text-slate-400 mt-2">
                          Locked by {config.lockedBy}{config.lockedAt ? ` · ${new Date(config.lockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {filteredGroups.length === 0 && (
        <div className="text-center py-12 text-sm text-slate-400">No settings pages match "{query}"</div>
      )}
    </div>
  );
}