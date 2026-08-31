import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import SettingsSidebar from '@/components/SettingsSidebar';

/**
 * Mobile menu for the Settings area.
 *
 * On desktop (lg+) the SettingsSidebar is always visible. On mobile it is
 * hidden, so this component provides a tappable "Menu" button that opens the
 * same sidebar in a full-screen overlay drawer. This lets the Settings
 * overview be minimal (stats + a "use the menu" message) while still giving
 * mobile users a way to reach every settings page.
 */
export default function SettingsMobileNav({ activeTab, onNavigate, items }) {
  const [open, setOpen] = useState(false);

  const handleNavigate = (id) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2E5A1A] hover:bg-[#1c4a12] shadow-sm transition active:scale-95"
      >
        <Menu className="w-4 h-4" />
        Settings Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-xs bg-white shadow-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 flex-shrink-0">
              <span className="font-bold text-slate-900">Settings Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SettingsSidebar activeTab={activeTab} onNavigate={handleNavigate} items={items} hideHeader />
            </div>
          </div>
        </div>
      )}
    </>
  );
}