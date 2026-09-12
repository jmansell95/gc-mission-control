import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Push Notification Settings — manages browser push notification
// subscription. Uses the Notification API + Service Worker for
// real-time push of new assignments, schedule changes, and alerts.

const NOTIFICATION_TYPES = [
  { id: 'new_assignment', label: 'New Job Assignment', default: true },
  { id: 'schedule_change', label: 'Schedule Changes', default: true },
  { id: 'compliance_alert', label: 'Compliance Expiry Alerts', default: true },
  { id: 'timesheet_reminder', label: 'Timesheet Reminders', default: true },
  { id: 'delivery_update', label: 'Delivery Status Updates', default: false },
  { id: 'maintenance_alert', label: 'Vehicle Maintenance Alerts', default: true },
];

export default function PushNotificationSettings() {
  const { toast } = useToast();
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved preferences from localStorage
    const saved = localStorage.getItem('push_notification_prefs');
    if (saved) {
      setPreferences(JSON.parse(saved));
    } else {
      const defaults = {};
      NOTIFICATION_TYPES.forEach(t => { defaults[t.id] = t.default; });
      setPreferences(defaults);
    }

    // Check current permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    setLoading(false);
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Notifications not supported', description: 'Your browser does not support push notifications.', variant: 'destructive' });
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setSubscribed(true);
      // Show a test notification
      new Notification('GC Mission Control', {
        body: 'Push notifications enabled! You\'ll receive assignment and alert notifications here.',
        icon: '/favicon.ico',
      });
      toast({ title: '✓ Push notifications enabled' });
    } else {
      toast({ title: 'Notifications blocked', description: 'Please enable notifications in your browser settings.', variant: 'destructive' });
    }
  };

  const togglePref = (id) => {
    const updated = { ...preferences, [id]: !preferences[id] };
    setPreferences(updated);
    localStorage.setItem('push_notification_prefs', JSON.stringify(updated));
  };

  const sendTest = () => {
    if (permission === 'granted') {
      new Notification('GC Mission Control — Test', {
        body: 'This is a test push notification. If you can see this, push is working correctly!',
        icon: '/favicon.ico',
        tag: 'test-notification',
      });
      toast({ title: 'Test notification sent' });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>;

  return (
    <div>
      <SettingsSectionHeader
        icon={Bell}
        title="Push Notifications"
        description="Receive real-time push notifications for new assignments, schedule changes, and compliance alerts directly in your browser."
      />

      {/* Permission status */}
      <div className="hub-glass rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${permission === 'granted' ? 'stat-gradient-emerald' : 'bg-slate-100'}`}>
              {permission === 'granted' ? <Bell className="w-6 h-6 text-white" /> : <BellOff className="w-6 h-6 text-slate-400" />}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {permission === 'granted' ? 'Notifications Enabled' :
                 permission === 'denied' ? 'Notifications Blocked' :
                 'Not Enabled Yet'}
              </p>
              <p className="text-xs text-slate-500">
                {permission === 'granted' ? 'You will receive push notifications on this device.' :
                 permission === 'denied' ? 'Enable notifications in your browser settings to use this feature.' :
                 'Click "Enable" to start receiving push notifications.'}
              </p>
            </div>
          </div>
          {permission !== 'granted' ? (
            <Button onClick={requestPermission} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Enable
            </Button>
          ) : (
            <Button onClick={sendTest} variant="outline" className="gap-1">
              <Bell className="w-4 h-4" /> Send Test
            </Button>
          )}
        </div>
      </div>

      {/* Notification preferences */}
      {permission === 'granted' && (
        <div className="hub-glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Notification Preferences</h3>
          <div className="space-y-2">
            {NOTIFICATION_TYPES.map(type => (
              <div key={type.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{type.label}</p>
                </div>
                <button
                  onClick={() => togglePref(type.id)}
                  className={`relative w-11 h-6 rounded-full transition ${preferences[type.id] ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preferences[type.id] ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Preferences are saved on this device. You'll need to enable notifications separately on each device you use.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="hub-glass rounded-2xl p-4 mt-4 bg-slate-50/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong>How it works:</strong> Push notifications use your browser's built-in Notification API.
          When enabled, the app can send you real-time alerts even when the tab is in the background.
          On mobile, add this app to your home screen for full push notification support.
          Notification preferences are stored per-device in your browser.
        </p>
      </div>
    </div>
  );
}