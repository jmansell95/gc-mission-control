import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, User, HelpCircle, LogOut, ChevronDown, Truck, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isFieldStaff } from '@/utils/access';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import SelfServiceHub from '@/components/staff/SelfServiceHub';

export default function DashboardUserMenu() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [open]);

  const displayName = profile?.name || authUser?.full_name || authUser?.email || 'User';
  const displayAvatar = profile?.avatar_url || null;
  const isField = isFieldStaff(profile, authUser?.role === 'admin');

  const handleLogout = async () => { await base44.auth.logout('/'); };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 rounded-xl bg-white border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition shadow-sm cursor-pointer touch-manipulation select-none"
      >
        <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={34} />
        <div className="text-left hidden sm:block">
          <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[140px]">{displayName}</p>
          <p className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">{profile?.email || authUser?.email || ''}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            {(profile?.email || authUser?.email) && <p className="text-xs text-slate-500 truncate mt-0.5">{profile?.email || authUser?.email}</p>}
          </div>
          <div className="py-1">
            {isField && (
              <button onClick={() => { navigate('/staff-schedule'); setOpen(false); }} type="button"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                <CalendarDays className="w-4 h-4 text-slate-400" /> My Schedule
              </button>
            )}
            <button onClick={() => { setShowRequests(true); setOpen(false); }} type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
              <FileText className="w-4 h-4 text-slate-400" /> My Requests
            </button>
            <button onClick={() => { navigate('/staff-profile'); setOpen(false); }} type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
              <User className="w-4 h-4 text-slate-400" /> My Profile
            </button>
            {profile?.delivery_dashboard_enabled && (
              <button onClick={() => { navigate('/deliveries'); setOpen(false); }} type="button"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                <Truck className="w-4 h-4 text-slate-400" /> Driver Hub
              </button>
            )}
            <button onClick={() => { navigate('/help'); setOpen(false); }} type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
              <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
            </button>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={() => { handleLogout(); setOpen(false); }} type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}

      {/* My Requests side sheet — SelfServiceHub for office staff */}
      <Sheet open={showRequests} onOpenChange={setShowRequests}>
        <SheetContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <SheetHeader className="px-5 py-4 border-b border-slate-100 sticky top-0 bg-background z-10">
            <SheetTitle className="text-lg font-bold text-slate-900">My Requests</SheetTitle>
          </SheetHeader>
          <div className="p-5">
            <SelfServiceHub staff={profile} divisionId={profile?.division_id} initialTab="requests" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}