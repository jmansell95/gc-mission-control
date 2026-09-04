import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Smartphone, Copy, ClipboardCheck, MapPin, ShieldCheck,
  CheckCircle2, AlertCircle, RefreshCw, Download, Apple,
  ChevronDown, ChevronUp, KeyRound, ExternalLink, User,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const APP_BASE = 'https://gc-mission-control.base44.app';
const WEBHOOK_URL = `${APP_BASE}/functions/receivePhoneGps`;

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }, [text]);
  return (
    <button onClick={copy}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#2E5A1A] bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 transition">
      {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-700/60 bg-[#0d1117]">
      <div className="absolute top-2 right-2 z-10">
        <CopyButton text={String(children).replace(/\n$/, '')} />
      </div>
      <pre className="overflow-x-auto p-4 pr-20 text-[12px] leading-relaxed text-slate-100 font-mono no-scrollbar">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function PhoneGpsTrackingSetup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Fetch the phone GPS config (shared secret)
  const { data: configRecord, isLoading } = useQuery({
    queryKey: ['phone-gps-config'],
    queryFn: async () => {
      const res = await base44.entities.AppSetting.filter({ key: 'phone_gps_config' });
      return res[0] || null;
    },
  });

  // Fetch staff with tracking enabled
  const { data: staffList = [] } = useQuery({
    queryKey: ['phone-gps-staff'],
    queryFn: () => base44.entities.Staff.filter({ tracking_enabled: true, is_active: true }, 'name', 500),
  });

  const secret = configRecord?.value?.secret || '';

  const generateSecret = async () => {
    setGenerating(true);
    try {
      const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      if (configRecord?.id) {
        await base44.entities.AppSetting.update(configRecord.id, {
          value: { ...(configRecord.value || {}), secret: newSecret, enabled: true, updated_at: new Date().toISOString() },
        });
      } else {
        await base44.entities.AppSetting.create({
          key: 'phone_gps_config',
          label: 'Phone GPS Tracking',
          value: { secret: newSecret, enabled: true, created_at: new Date().toISOString() },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['phone-gps-config'] });
      toast({ title: 'Shared secret generated', description: 'Update all configured phones with the new secret.' });
    } catch (e) {
      toast({ title: 'Failed to generate secret', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const buildGpsLoggerUrl = (staffId) => {
    return `${WEBHOOK_URL}?secret=${secret}&staff_id=${staffId}&lat=%LAT&lon=%LON&timestamp=%TIMESTAMP&accuracy=%ACC&speed=%SPD&heading=%BRG`;
  };

  const buildOwnTracksUrl = (staffId) => {
    return `${WEBHOOK_URL}?secret=${secret}&staff_id=${staffId}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">Phone GPS Tracking (Free)</h2>
            <p className="text-sm text-slate-500 mt-1">
              Track field crew in the background — even with the app closed — using free open-source GPS apps.
              No Capacitor build, no paid service. GPS pings feed directly into your existing Tracking Hub and geofence engine.
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Generate shared secret ── */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2E5A1A] text-white text-sm font-bold flex items-center justify-center">1</div>
            <KeyRound className="w-5 h-5 text-[#2E5A1A]" />
            <h3 className="font-bold text-slate-900 text-sm">Generate Shared Secret</h3>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500 mb-4">
            This secret authenticates GPS pings from external apps. Generate one, then include it in each phone's configuration.
          </p>
          {isLoading ? (
            <div className="h-12 shimmer rounded-xl bg-slate-100" />
          ) : secret ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-sm text-slate-700 truncate">
                {secret}
              </div>
              <CopyButton text={secret} label="Copy Secret" />
              <button onClick={generateSecret} disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition">
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Regenerate
              </button>
            </div>
          ) : (
            <button onClick={generateSecret} disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#2E5A1A] hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm">
              <KeyRound className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Generate Shared Secret
            </button>
          )}
          {!secret && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Generate a secret before configuring phones.
            </p>
          )}
        </div>
      </div>

      {/* ── Step 2: Configure each staff member's phone ── */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2E5A1A] text-white text-sm font-bold flex items-center justify-center">2</div>
            <User className="w-5 h-5 text-[#2E5A1A]" />
            <h3 className="font-bold text-slate-900 text-sm">Configure Each Staff Member's Phone</h3>
            <span className="ml-auto text-xs text-slate-400">{staffList.length} staff with tracking enabled</span>
          </div>
        </div>
        <div className="p-3">
          {!secret ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Generate a shared secret first, then configure each phone here.
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No staff members have tracking enabled. Enable tracking on staff profiles first.
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map(staff => {
                const isExpanded = expandedStaff === staff.id;
                const gpsLoggerUrl = buildGpsLoggerUrl(staff.id);
                const ownTracksUrl = buildOwnTracksUrl(staff.id);
                return (
                  <div key={staff.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    <button onClick={() => setExpandedStaff(isExpanded ? null : staff.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {staff.avatar_url ? (
                          <img src={staff.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-slate-500">{staff.name?.charAt(0) || '?'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{staff.name}</p>
                        <p className="text-xs text-slate-400 truncate">{staff.job_title || staff.worker_type || 'Staff'}</p>
                      </div>
                      {staff.tracking_consent_signed_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Consent signed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" /> No consent
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-slate-50/50 border-t border-slate-100">
                        {/* GPSLogger (Android) */}
                        <div className="pt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Download className="w-4 h-4 text-emerald-600" />
                            <h4 className="text-sm font-bold text-slate-700">GPSLogger for Android</h4>
                            <a href="https://play.google.com/store/apps/details?id=com.mendhak.gpslogger" target="_blank" rel="noopener"
                              className="inline-flex items-center gap-0.5 text-xs text-[#2E5A1A] hover:underline">
                              <ExternalLink className="w-3 h-3" /> Get the app
                            </a>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">
                            In GPSLogger → <strong>Logging settings</strong> → <strong>Custom URL</strong>, paste this:
                          </p>
                          <CodeBlock>{gpsLoggerUrl}</CodeBlock>
                          <p className="text-xs text-slate-400 mt-2">
                            Set <strong>Log to custom URL</strong> as the only destination. Set interval to 1–5 minutes.
                            Enable <strong>Keep GPS alive between fixes</strong> in GPSLogger settings for background operation.
                          </p>
                        </div>
                        {/* OwnTracks (iOS / Android) */}
                        <div className="pt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Apple className="w-4 h-4 text-slate-600" />
                            <h4 className="text-sm font-bold text-slate-700">OwnTracks (iOS & Android)</h4>
                            <a href="https://owntracks.org" target="_blank" rel="noopener"
                              className="inline-flex items-center gap-0.5 text-xs text-[#2E5A1A] hover:underline">
                              <ExternalLink className="w-3 h-3" /> Get the app
                            </a>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">
                            In OwnTracks → <strong>Settings</strong> → <strong>Connection</strong>:
                          </p>
                          <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex gap-2"><span className="font-semibold text-slate-700 w-20">Mode:</span> HTTP</div>
                            <div className="flex gap-2"><span className="font-semibold text-slate-700 w-20">Host:</span> <code className="text-[#2E5A1A] break-all">{ownTracksUrl}</code></div>
                            <div className="flex gap-2"><span className="font-semibold text-slate-700 w-20">Device ID:</span> <code className="text-slate-500">{staff.id.slice(0, 8)}</code></div>
                            <div className="flex gap-2"><span className="font-semibold text-slate-700 w-20">Tracking:</span> On (background location enabled in iOS/Android settings)</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Step 3: How it works ── */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2E5A1A] text-white text-sm font-bold flex items-center justify-center">3</div>
            <MapPin className="w-5 h-5 text-[#2E5A1A]" />
            <h3 className="font-bold text-slate-900 text-sm">How It Works</h3>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Smartphone, title: 'Phone sends GPS', desc: 'GPSLogger or OwnTracks runs natively in the background and POSTs location fixes every 1–5 minutes — even with our app closed.' },
            { icon: ShieldCheck, title: 'Webhook validates', desc: 'The receivePhoneGps webhook checks the shared secret, looks up the staff member, and verifies tracking consent.' },
            { icon: MapPin, title: 'Feeds Tracking Hub', desc: 'GPS points create StaffLocationLog entries and trigger the geofence engine — identical to the in-app tracker. Live map, travel timesheets, everything just works.' },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="rounded-xl bg-slate-50/70 border border-slate-100 p-4">
                <div className="w-9 h-9 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-[#2E5A1A]" />
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">{step.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Why this is free ── */}
      <div className="insight-card rounded-2xl p-5 bg-emerald-50/30 border-emerald-200/50">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-800">100% Free — No Paid Services</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              GPSLogger (Android) and OwnTracks (iOS/Android) are free, open-source apps available on the Google Play Store and Apple App Store.
              They run as native background services, so GPS stays alive even when our app is closed — no Capacitor build, no native wrapper, no monthly fees.
              Location data flows into your existing Tracking Hub, geofence engine, and travel-timesheet pipeline with zero additional infrastructure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}