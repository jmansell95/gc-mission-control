import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Logo, { LandWaterLogo } from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

/**
 * EnterpriseHeader — self-contained mobile top bar for the Enterprise Dashboard.
 *
 * Unlike AdminNav, this header has NO division sidebar, NO hamburger menu, and
 * NO division switcher. It is a minimal bar with just the logo and a profile
 * dropdown (Help, Logout). The Enterprise Dashboard is a standalone page above
 * all divisions — division navigation only appears after you enter a division.
 *
 * Mobile only (xl:hidden). On desktop, the profile dropdown lives in the hero
 * section of the EnterpriseDashboard itself.
 */
export default function EnterpriseHeader() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [menuOpen]);

  const displayName = profile?.name || user?.full_name || user?.email || 'User';
  const displayAvatar = profile?.avatar_url || null;

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  return (
    <header
      className="lg:hidden sticky top-0 inset-x-0 z-40 border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="absolute inset-0 sidebar-modern" />
      <div className="relative z-10 h-14 flex items-center justify-between px-3">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Logo height={26} />

        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Profile menu"
            type="button"
            className="relative flex items-center justify-center active:scale-95 rounded-full transition flex-shrink-0 touch-manipulation select-none ring-2 ring-transparent hover:ring-white/20"
          >
            <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={32} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                {user?.email && <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>}
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate('/enterprise/help'); setMenuOpen(false); }}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                </button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}