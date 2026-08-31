import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, HelpCircle, User, CalendarDays, Truck, Bell, Crown, ScanLine, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import DivisionSwitcher from '@/components/DivisionSwitcher';
import GlobalSearch from '@/components/GlobalSearch';

export default function MobileNavDrawer({ isOpen, onClose, navItems, activeSection, onNavigate, onLogout, onHelp, onProfile, onDeliveries, onNotifications, notifCount = 0, profile, onEnterprise, onScan, onAIHub }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[82%] max-w-xs sidebar-modern border-r border-black/20 flex flex-col shadow-2xl"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="flex flex-col items-start flex-shrink-0">
                <Logo variant="full" height={36} tone="light" />
                <p className="text-left text-[11px] text-white/70 mt-1.5 font-display font-semibold uppercase tracking-[0.22em]">Admin Panel</p>
              </div>
              {profile && (
                <button type="button" onClick={() => { onProfile?.(); onClose(); }} title={`${profile.name} — ${profile.email}`}
                  className="flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer touch-manipulation select-none">
                  <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size={38} />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-white truncate leading-tight">{profile.name?.split(' ')[0]}</p>
                  </div>
                </button>
              )}
              <button onClick={onClose} aria-label="Close menu" type="button"
                className="h-9 w-9 flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white rounded-lg transition flex-shrink-0 touch-manipulation">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Division switcher — parity with desktop sidebar */}
            <div className="px-3 pt-2 pb-1">
              <DivisionSwitcher variant="sidebar" />
            </div>

            {/* Search — parity with desktop sidebar footer */}
            <div className="px-3 pb-2"><GlobalSearch /></div>

            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto overscroll-contain">
              {onEnterprise && (
                <button type="button"
                  onClick={() => { onEnterprise(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold mb-2 transition touch-manipulation select-none bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-200 hover:from-amber-500/30 hover:to-amber-600/20 ring-1 ring-amber-400/30">
                  <Crown className="w-5 h-5 flex-shrink-0 text-amber-300" />
                  <span>Enterprise Command</span>
                </button>
              )}
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                if (item.comingSoon) {
                  return (
                    <div key={item.id} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed select-none">
                      <Icon className="w-5 h-5 flex-shrink-0 text-white/40" />
                      <span className="text-white/40 flex-1">{item.label}</span>
                      <span className="text-[9px] font-bold text-white/40 bg-white/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Soon</span>
                    </div>
                  );
                }
                return (
                  <button key={item.id} type="button"
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition touch-manipulation select-none ${
                      isActive
                        ? 'bg-white/15 text-white shadow-[inset_3px_0_0_0_#8DC63F]'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer — quick actions matching the desktop sidebar */}
            <div className="px-3 py-3 border-t border-white/10 space-y-1.5 flex-shrink-0">
              {onScan && (
                <button type="button" onClick={() => { onScan(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition touch-manipulation select-none">
                  <ScanLine className="w-5 h-5 flex-shrink-0 text-[#8DC63F]" />
                  <span>Scan Asset</span>
                </button>
              )}
              {onAIHub && (
                <button type="button" onClick={() => { onAIHub(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white hover:opacity-90 transition touch-manipulation select-none shadow-lg glow-brand">
                  <Sparkles className="w-5 h-5 flex-shrink-0" />
                  <span>AI Hubs</span>
                </button>
              )}
              {onDeliveries && (
                <button type="button" onClick={() => { onDeliveries(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition touch-manipulation select-none">
                  <Truck className="w-5 h-5 flex-shrink-0" />
                  <span>Deliveries</span>
                </button>
              )}
              {onHelp && (
                <button type="button" onClick={() => { onHelp(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition touch-manipulation select-none">
                  <HelpCircle className="w-5 h-5 flex-shrink-0" />
                  <span>Help Guides</span>
                </button>
              )}
              {onLogout && (
                <button type="button" onClick={() => { onLogout(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition touch-manipulation select-none">
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span>Logout</span>
                </button>
              )}
            </div>

          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}