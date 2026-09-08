import React, { useState } from 'react';
import { LogOut, Phone, WifiOff, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import StaffMaintenanceReportModal from '@/components/staff/StaffMaintenanceReportModal';

// Premium staff header — gradient brand bar with greeting, live clock,
// connection status, and a quick scanner shortcut button.
export default function StaffHeader({ staff, onShowSchedule }) {
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const firstName = staff?.name?.split(' ')[0] || 'Team';

  return (
    <div className="bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo height={40} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-bold text-ui-body leading-tight truncate">
                {greeting}, {firstName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-white/70 text-ui-caption">{format(new Date(), 'EEE dd MMM · HH:mm')}</p>
                <span className={`inline-flex items-center gap-0.5 text-ui-micro font-semibold px-1.5 py-0.5 rounded-full ${isOnline ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowNumbers(true)} type="button" aria-label="Useful Numbers"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <Phone className="w-5 h-5" />
            </button>
            <button onClick={() => base44.auth.logout('/login')} type="button" aria-label="Logout"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
        onLogBooking={() => { setShowNumbers(false); setShowReport(true); }} />
      <StaffMaintenanceReportModal open={showReport} onClose={() => setShowReport(false)} staff={staff} />
    </div>
  );
}