import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  UserCheck, UserX, Clock, Mail, Loader2, Search, CheckCircle2, XCircle,
} from 'lucide-react';

/**
 * PendingAccessQueue — admin Settings page showing all platform users
 * with access_status='pending'. Admins can approve or reject each user.
 * Approved users get a welcome email; rejected users see a rejection
 * screen on next login.
 */
export default function PendingAccessQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['pending-access-users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getUnlinkedUsers');
      const data = res.data || res;
      // getUnlinkedUsers returns all unlinked users — we need ALL users to check access_status
      // So fetch all users directly instead
      const allUsers = await base44.entities.User.list('-created_date', 500);
      return allUsers.filter((u) => u.access_status === 'pending');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (userId) => base44.functions.invoke('approveUserAccess', { user_id: userId, action: 'approve' }),
    onSuccess: () => {
      toast({ title: 'User approved', description: 'They can now sign in to GC Mission Control.' });
      qc.invalidateQueries({ queryKey: ['pending-access-users'] });
    },
    onError: (e) => toast({ title: 'Failed to approve', description: e.message || 'Unknown error', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId) => base44.functions.invoke('approveUserAccess', { user_id: userId, action: 'reject' }),
    onSuccess: () => {
      toast({ title: 'User rejected', description: 'They will see a rejection screen on next login.' });
      qc.invalidateQueries({ queryKey: ['pending-access-users'] });
    },
    onError: (e) => toast({ title: 'Failed to reject', description: e.message || 'Unknown error', variant: 'destructive' }),
  });

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return users;
    return users.filter((u) =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, q]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">
            {users.length} {users.length === 1 ? 'user is' : 'users are'} waiting for access approval
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Approve users to grant them access, or reject to deny. Approved users receive a welcome email.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30"
        />
      </div>

      {/* Pending users list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No pending access requests</p>
          <p className="text-xs text-slate-400 mt-1">Everyone who has logged in has been approved.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-slate-500">
                  {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                </span>
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {u.full_name || 'No name set'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{u.email}</span>
                </div>
                {u.created_date && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    First login: {new Date(u.created_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(u.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(u.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <UserX className="w-4 h-4 mr-1.5" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}