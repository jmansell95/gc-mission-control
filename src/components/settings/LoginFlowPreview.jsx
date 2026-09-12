import React, { useState } from 'react';
import { Smartphone, X, Eye, Lock, AlertTriangle, ShieldX, HelpCircle } from 'lucide-react';
import AccessGateScreen from '@/components/AccessGateScreen';
import DomainAccessError from '@/components/DomainAccessError';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const MOCK = {
  email: 'jordan.smith@outlook.com',
  badDomainEmail: 'jordan.smith@gmail.com',
  approvers: [
    { name: 'Jordan Mansell', email: 'jordan@ground-control.co.uk' },
    { name: 'Sarah Lee', email: 'sarah@ground-control.co.uk' },
  ],
};

const SCENARIOS = [
  { id: 'pending', label: 'Pending Access', icon: Lock, hint: 'First login, waiting for approval', tone: 'amber' },
  { id: 'rejected', label: 'Rejected', icon: AlertTriangle, hint: 'Admin denied access', tone: 'rose' },
  { id: 'domain', label: 'Wrong Domain', icon: ShieldX, hint: 'Non ground-control email', tone: 'rose' },
  { id: 'not_registered', label: 'Not Registered', icon: HelpCircle, hint: 'No user record found', tone: 'orange' },
];

const toneRing = {
  amber: 'border-amber-300 bg-amber-50 text-amber-700',
  rose: 'border-rose-300 bg-rose-50 text-rose-700',
  orange: 'border-orange-300 bg-orange-50 text-orange-700',
};
const toneActive = {
  amber: 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/25',
  rose: 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/25',
  orange: 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/25',
};

export default function LoginFlowPreview({ contactInstructions = '' }) {
  const [active, setActive] = useState(null);

  const renderScreen = () => {
    switch (active) {
      case 'pending':
        return <AccessGateScreen status="pending" email={MOCK.email} approvers={MOCK.approvers} contactInstructions={contactInstructions} onLogout={() => {}} />;
      case 'rejected':
        return <AccessGateScreen status="rejected" email={MOCK.email} onLogout={() => {}} />;
      case 'domain':
        return <DomainAccessError email={MOCK.badDomainEmail} onBackToLogin={() => {}} />;
      case 'not_registered':
        return <UserNotRegisteredError />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl hub-glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <Eye className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900">Login Flow Preview</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        See exactly what a user sees at each gate state. Tap a scenario to preview it in the phone frame.
      </p>

      {/* Scenario buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(isActive ? null : s.id)}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${isActive ? toneActive[s.tone] : toneRing[s.tone] + ' hover:shadow-sm'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-bold leading-tight">{s.label}</span>
              <span className={`text-[10px] leading-tight ${isActive ? 'text-white/80' : 'opacity-70'}`}>{s.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Phone frame preview */}
      {active ? (
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* Phone shell */}
            <div className="w-[300px] h-[600px] rounded-[2.5rem] bg-slate-900 p-2.5 shadow-2xl shadow-slate-900/30 border border-slate-700">
              {/* Notch */}
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-full z-10 flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <div className="w-8 h-1 rounded-full bg-slate-700" />
              </div>
              {/* Screen */}
              <div className="w-full h-full rounded-[2rem] bg-white overflow-hidden relative">
                {/* Preview badge */}
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-1.5 bg-slate-900/85 backdrop-blur text-white text-[10px] font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    PREVIEW
                  </span>
                  <span className="text-white/60">{SCENARIOS.find((s) => s.id === active)?.label}</span>
                </div>
                {/* Scrollable screen content */}
                <div className="absolute inset-0 pt-7 overflow-y-auto">
                  <div className="min-h-full">
                    {renderScreen()}
                  </div>
                </div>
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={() => setActive(null)}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition z-30"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 text-center max-w-[280px]">
            This is a live preview using mock data. Buttons are disabled so you stay logged in.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          <Smartphone className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400 text-center">Select a scenario above to preview the screen</p>
        </div>
      )}
    </div>
  );
}