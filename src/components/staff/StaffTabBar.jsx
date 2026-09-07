import React from 'react';
import { CalendarClock, CalendarDays, LayoutGrid, ScanLine, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Bottom nav: Today · Upcoming · [Scan FAB] · Profile · More
export default function StaffTabBar({ activeTab, onChange, counts = {} }) {
  const navigate = useNavigate();

  const sideTabs = [
    { key: 'today', label: 'Today', icon: CalendarClock, badge: counts.today },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, badge: counts.upcoming },
  ];

  const renderTab = (tab) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.key;
    const showBadge = tab.badge != null && tab.badge > 0;
    return (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        type="button"
        className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition touch-manipulation ${
          isActive ? 'text-[#2E5A1A]' : 'text-slate-400'
        }`}
      >
        {isActive && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full" />
        )}
        <div className="relative">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isActive ? 'bg-[#2E5A1A]/10' : ''}`}>
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
          </div>
          {showBadge && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-white ${
              isActive ? 'bg-[#2E5A1A] text-white' : 'bg-slate-300 text-white'
            }`}>
              {tab.badge > 9 ? '9+' : tab.badge}
            </span>
          )}
        </div>
        <span className={`text-[11px] font-semibold ${isActive ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>
          {tab.label}
        </span>
      </button>
    );
  };

  const renderNavButton = (tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.key}
        onClick={() => navigate(tab.path)}
        type="button"
        className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition touch-manipulation text-slate-400 hover:text-[#2E5A1A]"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:bg-[#2E5A1A]/10">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 hub-glass safe-area-bottom">
      <div className="max-w-6xl mx-auto flex items-stretch justify-around px-2 relative">
        {renderTab(sideTabs[0])}
        {renderTab(sideTabs[1])}

        {/* Center Scanner FAB — prominent, elevated with glow */}
        <button
          onClick={() => navigate('/scanner')}
          type="button"
          className="flex flex-col items-center justify-center gap-1 px-2 touch-manipulation"
        >
          <div className="w-14 h-14 -mt-6 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white flex items-center justify-center shadow-xl shadow-[#2E5A1A]/40 ring-4 ring-white active:scale-90 transition glow-brand">
            <ScanLine className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-[#2E5A1A]">Scan</span>
        </button>

        {renderNavButton({ key: 'profile', label: 'Profile', icon: UserCircle, path: '/staff-profile' })}
        {renderTab({ key: 'more', label: 'More', icon: LayoutGrid })}
      </div>
    </nav>
  );
}