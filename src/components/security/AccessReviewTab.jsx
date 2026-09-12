import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  UserCheck, CheckCircle2, AlertTriangle, Loader2, Search, Shield, Clock,
} from 'lucide-react';

const STATUS_BADGE = {
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  reduced: { label: 'Reduced', bg: 'bg-amber-50', text: 'text-amber-700' },
  revoked: { label: 'Revoked', bg: 'bg-rose-50', text: 'text-rose-700' },
  escalated: { label: 'Escalated', bg: 'bg-violet-50', text: 'text-violet-700' },
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function AccessReviewTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | needs_review | inactive | high_privilege
  const [reviewing, setReviewing] = useState(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['access-review-staff'],
    queryFn: () => base44.entities.Staff.list(500),
    staleTime: 60000,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ['access-reviews'],
    queryFn: () => base44.entities.AccessReview.list('-reviewed_at', 500),
    staleTime: 60000,
  });

  // Map latest review per user
  const latestReviewByUser = useMemo(() => {
    const map = {};
    for (const r of reviews) {
      if (!map[r.reviewed_user_id] || new Date(r.reviewed_at) > new Date(map[r.reviewed_user_id].reviewed_at)) {
        map[r.reviewed_user_id] = r;
      }
    }
    return map;
  }, [reviews]);

  const usersWithAccess = useMemo(() => {
    return staff.filter(s => s.user_id || s.is_admin || s.system_role === 'admin');
  }, [staff]);

  const filtered = useMemo(() => {
    let result = usersWithAccess;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'needs_review') {
      result = result.filter(s => {
        const review = latestReviewByUser[s.user_id || s.id];
        return !review || daysSince(review.reviewed_at) > 90;
      });
    } else if (filter === 'inactive') {
      result = result.filter(s => s.is_active === false);
    } else if (filter === 'high_privilege') {
      result = result.filter(s => s.system_role === 'admin' || s.system_role === 'super_admin' || s.is_admin || s.enterprise_role === 'enterprise_admin');
    }
    return result;
  }, [usersWithAccess, search, filter, latestReviewByUser]);

  const handleReview = async (staffMember, status) => {
    setReviewing(staffMember.id);
    try {
      await base44.entities.AccessReview.create({
        reviewed_user_id: staffMember.user_id || staffMember.id,
        reviewed_staff_id: staffMember.id,
        reviewed_user_name: staffMember.name,
        reviewed_user_email: staffMember.email,
        reviewer_id: user.id,
        reviewer_name: user.full_name || user.email,
        reviewed_at: new Date().toISOString(),
        status,
        role_at_review: staffMember.system_role,
        enterprise_role_at_review: staffMember.enterprise_role,
        review_period: `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
        notes: status === 'confirmed' ? 'Access confirmed during quarterly review.' : 'Flagged during quarterly review.',
      });
      toast({ title: 'Review recorded', description: `${staffMember.name} marked as ${STATUS_BADGE[status].label}` });
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReviewing(null);
    }
  };

  const needsReviewCount = usersWithAccess.filter(s => {
    const review = latestReviewByUser[s.user_id || s.id];
    return !review || daysSince(review.reviewed_at) > 90;
  }).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="hub-glass rounded-xl p-3">
          <p className="text-xl font-bold text-slate-900 tabular-nums">{usersWithAccess.length}</p>
          <p className="text-[11px] text-slate-500 font-medium">Users with access</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <p className="text-xl font-bold text-amber-600 tabular-nums">{needsReviewCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">Need review (90d+)</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{usersWithAccess.length - needsReviewCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">Recently reviewed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'needs_review', label: 'Needs Review' },
            { id: 'inactive', label: 'Inactive' },
            { id: 'high_privilege', label: 'High Privilege' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="hub-glass rounded-2xl p-8 text-center">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No users match this filter.</p>
          </div>
        ) : (
          filtered.map(s => {
            const review = latestReviewByUser[s.user_id || s.id];
            const daysSinceReview = daysSince(review?.reviewed_at);
            const needsReview = !review || daysSinceReview > 90;
            const isAdmin = s.system_role === 'admin' || s.system_role === 'super_admin' || s.is_admin;

            return (
              <div key={s.id} className="hub-glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isAdmin ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isAdmin ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                    {isAdmin && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Admin</span>}
                    {s.is_active === false && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.email || 'No email'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {review ? (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-2.5 h-2.5" />
                        Reviewed {daysSinceReview}d ago · {STATUS_BADGE[review.status]?.label}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                        <AlertTriangle className="w-2.5 h-2.5" /> Never reviewed
                      </span>
                    )}
                  </div>
                </div>
                {needsReview && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReview(s, 'confirmed')}
                      disabled={reviewing === s.id}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                    >
                      {reviewing === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 inline mr-0.5" />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(s, 'revoked')}
                      disabled={reviewing === s.id}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}