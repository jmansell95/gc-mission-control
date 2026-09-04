import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Lock, Loader2, AlertCircle, CheckCircle2, FileQuestion,
  Users, Wrench, Package, Building2, Globe, FolderKanban, Briefcase,
  TrendingUp, PoundSterling, Clock, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import POAPriceLockModal from '@/components/billing/POAPriceLockModal';

const fmt = (n) => n != null && !isNaN(n) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const EXPIRY_WARN_DAYS = 30;

/**
 * Returns 'expired', 'expiring_soon', or 'active' based on the lock's expiry_date.
 * Withdrawn locks are treated as inactive (not shown with warning styling).
 */
function getExpiryStatus(lock) {
  if (lock.status === 'withdrawn') return 'inactive';
  if (!lock.expiry_date) return 'active';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(lock.expiry_date + 'T00:00:00');
  const daysLeft = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= EXPIRY_WARN_DAYS) return 'expiring_soon';
  return 'active';
}

const fmtExpiry = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const CATEGORY_META = {
  labour: { label: 'Labour', icon: Users, color: 'text-emerald-700 bg-emerald-50' },
  plant: { label: 'Plant', icon: Wrench, color: 'text-blue-700 bg-blue-50' },
  materials: { label: 'Materials', icon: Package, color: 'text-amber-700 bg-amber-50' },
};

const SOURCE_META = {
  our_company: { label: 'Our Rate Card', icon: Building2 },
  supplier: { label: 'Supplier', icon: Building2 },
};

/**
 * POA Worklist — shows all rate card items that are currently POA
 * (price = null, price_text = "POA"), with their lock status.
 * The contracts team uses this to identify outstanding POA items
 * and lock in prices for specific jobs or projects.
 */
export default function POAWorklist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLock, setFilterLock] = useState('all'); // all, locked, unlocked
  const [lockModalItem, setLockModalItem] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rate-card-items'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 1000),
  });

  const { data: locks = [] } = useQuery({
    queryKey: ['poa-locks'],
    queryFn: () => base44.entities.POAPriceLock.list('-agreed_at', 500),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rate-card-items'] });
    queryClient.invalidateQueries({ queryKey: ['poa-locks'] });
  };

  // POA items = price is null
  const poaItems = useMemo(() => {
    return items.filter((i) => i.price == null || isNaN(Number(i.price)));
  }, [items]);

  // Map of rate_card_item_id → locks
  const locksByItem = useMemo(() => {
    const map = {};
    for (const l of locks) {
      if (!map[l.rate_card_item_id]) map[l.rate_card_item_id] = [];
      map[l.rate_card_item_id].push(l);
    }
    return map;
  }, [locks]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = poaItems;
    if (filterSource !== 'all') {
      list = list.filter((i) => i.rate_card_source === filterSource);
    }
    if (filterCategory !== 'all') {
      list = list.filter((i) => i.category === filterCategory);
    }
    if (filterLock === 'locked') {
      list = list.filter((i) => locksByItem[i.id]?.length > 0);
    } else if (filterLock === 'unlocked') {
      list = list.filter((i) => !locksByItem[i.id]?.length);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.subcategory || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [poaItems, filterSource, filterCategory, filterLock, query, locksByItem]);

  // Stats
  const stats = useMemo(() => {
    const total = poaItems.length;
    const locked = poaItems.filter((i) => locksByItem[i.id]?.length > 0).length;
    const unlocked = total - locked;
    const lockedValue = locks.reduce((sum, l) => sum + (Number(l.stamped_value_gbp) || 0), 0);
    const expired = locks.filter(l => getExpiryStatus(l) === 'expired').length;
    const expiringSoon = locks.filter(l => getExpiryStatus(l) === 'expiring_soon').length;
    return { total, locked, unlocked, lockedValue, expired, expiringSoon };
  }, [poaItems, locks, locksByItem]);

  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || 'Unknown Project';
  const getJobName = (id) => jobs.find((j) => j.id === id)?.name || 'Unknown Job';

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={FileQuestion}
        title="POA Price Lock Manager"
        description="Manage Price on Application items — lock in agreed prices for outstanding POA rates and apply them to jobs"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="insight-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <FileQuestion className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Total POA</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</p>
        </div>
        <div className="insight-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Locked</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-700 tabular-nums">{stats.locked}</p>
        </div>
        <div className="insight-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Outstanding</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums">{stats.unlocked}</p>
        </div>
        <div className="insight-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <PoundSterling className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Value Stamped</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-700 tabular-nums">{fmt(stats.lockedValue)}</p>
        </div>
        <div className={`insight-card rounded-xl sm:rounded-2xl p-3 sm:p-4 ${(stats.expired > 0 || stats.expiringSoon > 0) ? 'ring-2 ring-amber-200' : ''}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className={`w-3.5 h-3.5 ${stats.expired > 0 ? 'text-red-500' : 'text-amber-500'}`} />
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Expiring ≤30d / Expired</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold tabular-nums">
            <span className={stats.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-400'}>{stats.expiringSoon}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className={stats.expired > 0 ? 'text-red-600' : 'text-slate-400'}>{stats.expired}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="insight-card rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search POA items..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2E5A1A] truncate"
          >
            <option value="all">All Sources</option>
            <option value="our_company">Our Rate Card</option>
            <option value="supplier">Supplier</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2E5A1A] truncate"
          >
            <option value="all">All Categories</option>
            <option value="labour">Labour</option>
            <option value="plant">Plant</option>
            <option value="materials">Materials</option>
          </select>
          <select
            value={filterLock}
            onChange={(e) => setFilterLock(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2E5A1A] truncate"
          >
            <option value="all">All Status</option>
            <option value="unlocked">Outstanding</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>

      {/* POA Items List */}
      <div className="insight-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500">
              {stats.total === 0 ? 'No POA items in the rate card' : 'No POA items match your filters'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {stats.total === 0
                ? 'All rate card items have prices. Great job!'
                : 'Try adjusting your filters or search query.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {filtered.map((item) => {
              const itemLocks = locksByItem[item.id] || [];
              const isLocked = itemLocks.length > 0;
              const CatIcon = CATEGORY_META[item.category]?.icon || Package;
              return (
                <div key={item.id} className="px-4 py-3 hover:bg-slate-50/50 transition">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CATEGORY_META[item.category]?.color || 'bg-slate-100'}`}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-800">{item.description}</p>
                        {item.price_text && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {item.price_text}
                          </span>
                        )}
                        {item.subcategory && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            {item.subcategory}
                          </span>
                        )}
                        {item.unit && (
                          <span className="text-[10px] text-slate-400">/{item.unit}</span>
                        )}
                      </div>

                      {/* Lock badges */}
                      {isLocked && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {itemLocks.map((lock) => {
                            const scopeIcon = lock.scope === 'global' ? Globe : lock.scope === 'project' ? FolderKanban : Briefcase;
                            const ScopeIcon = scopeIcon;
                            const scopeLabel = lock.scope === 'global'
                              ? 'Global'
                              : lock.scope === 'project'
                                ? getProjectName(lock.project_id)
                                : getJobName(lock.job_id);
                            const expiry = getExpiryStatus(lock);
                            const badgeClass = expiry === 'expired'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : expiry === 'expiring_soon'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                            const dotClass = expiry === 'expired'
                              ? 'bg-red-500'
                              : expiry === 'expiring_soon'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500';
                            return (
                              <span
                                key={lock.id}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}
                                title={`Locked by ${lock.agreed_by_name} on ${new Date(lock.agreed_at).toLocaleDateString('en-GB')}${lock.client_reference ? ` — Ref: ${lock.client_reference}` : ''}${lock.expiry_date ? ` — Expires ${fmtExpiry(lock.expiry_date)}` : ''}`}
                              >
                                <Lock className="w-2.5 h-2.5" />
                                {fmt(lock.agreed_price)}
                                <span className="opacity-40 font-normal">·</span>
                                <ScopeIcon className="w-2.5 h-2.5" />
                                {scopeLabel}
                                {lock.stamped_records > 0 && (
                                  <span className="opacity-60 font-normal">({lock.stamped_records} stamped)</span>
                                )}
                                {expiry === 'expired' && (
                                  <span className="inline-flex items-center gap-0.5 font-bold">
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />Expired
                                  </span>
                                )}
                                {expiry === 'expiring_soon' && (
                                  <span className="inline-flex items-center gap-0.5 font-bold">
                                    <Clock className="w-2.5 h-2.5" />Exp {fmtExpiry(lock.expiry_date)}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <button
                        onClick={() => setLockModalItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-[#2E5A1A] text-white hover:bg-[#1c4a12]"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {isLocked ? 'Add Lock' : 'Lock Price'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lock Modal */}
      {lockModalItem && (
        <POAPriceLockModal
          item={lockModalItem}
          projects={projects}
          jobs={jobs}
          existingLocks={locksByItem[lockModalItem.id] || []}
          onClose={() => setLockModalItem(null)}
          onLocked={() => {
            setLockModalItem(null);
            refresh();
            toast({ title: 'POA price locked', description: 'All matching unpriced logs have been stamped.' });
          }}
        />
      )}
    </div>
  );
}