import React, { useState, useCallback } from 'react';
import {
  Smartphone, Download, Copy, ClipboardCheck, Truck, MapPin,
  ShieldCheck, Settings, Apple, CheckCircle2, AlertCircle, Code,
  Package, Rocket, FileText, ChevronRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

function CodeBlock({ children, language }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }, [code]);
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0d1117]">
      <button
        onClick={copy}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/80 text-slate-200 text-[11px] font-semibold hover:bg-slate-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-sm"
      >
        {copied ? <ClipboardCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100 font-mono no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function StepCard({ number, icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50/50 transition"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2E5A1A] text-white text-sm font-bold flex-shrink-0">
          {number}
        </div>
        <Icon className="w-5 h-5 text-[#2E5A1A] flex-shrink-0" />
        <span className="font-bold text-slate-900 text-sm flex-1">{title}</span>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

export default function BackgroundTrackingSetup() {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="print-area min-h-screen page-bg-vibrant">
      <PageHeader
        title="Background GPS Tracking Setup"
        subtitle="Native always-on staff tracking via Capacitor + background-geolocation plugin"
        meta="Setup Guide"
        icon={Smartphone}
        actions={(
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        )}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Overview */}
        <div className="insight-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2E5A1A]/10 flex-shrink-0">
              <MapPin className="w-6 h-6 text-[#2E5A1A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Why this is needed</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Base44's built-in native app is a <strong>secure webview wrapper</strong> — it runs
                web code inside a native shell. iOS and Android both suspend web code (and
                <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">navigator.geolocation</code>)
                when the app is backgrounded or closed. To track staff GPS <em>continuously, even when
                the app is closed</em>, the code must be exported and wrapped with
                <strong> Capacitor</strong> plus a native <strong>background-geolocation plugin</strong> that
                runs a native location service and posts GPS points to the existing
                <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">recordStaffLocation</code>
                endpoint on a native schedule.
              </p>
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  The Capacitor project lives <strong>outside Base44</strong>. This guide is the
                  deliverable for the developer doing the native wrap. The in-app tracker
                  (foreground) and vehicle-GPS proxy work without this — this guide is only for
                  the always-on (app-closed) native build.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How it fits together */}
        <div className="insight-card rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2E5A1A]" />
            How it fits together
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Smartphone className="w-8 h-8 text-[#2E5A1A] mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">1. Native plugin</p>
              <p className="text-xs text-slate-500 mt-1">Runs a native OS location service with "Always" permission — survives app close &amp; device reboot.</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <Code className="w-8 h-8 text-[#2E5A1A] mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">2. HTTP post</p>
              <p className="text-xs text-slate-500 mt-1">Plugin batches GPS points and POSTs them to the existing <code className="text-xs font-mono">recordStaffLocation</code> endpoint with the user's auth token.</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-200">
              <MapPin className="w-8 h-8 text-[#2E5A1A] mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">3. Live map</p>
              <p className="text-xs text-slate-500 mt-1">The existing Tracking Hub picks up the points via <code className="text-xs font-mono">StaffLocationLog</code> — no backend changes needed.</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 px-1">Step-by-step setup</h2>

          <StepCard number={1} icon={Package} title="Export the Base44 app code" defaultOpen>
            <p>
              From the Base44 editor, export the app's source code (Builder plan or higher).
              You can download a ZIP or push to a GitHub repo. This gives you the full React +
              Vite project that Base44 hosts.
            </p>
          </StepCard>

          <StepCard number={2} icon={Settings} title="Initialise a Capacitor project">
            <p>Inside the exported project directory, install Capacitor core and CLI:</p>
            <CodeBlock>{`npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init "GC Mission Control" "co.groundcontrol.missioncontrol" --web-dir=dist`}</CodeBlock>
            <p>Build the web assets and add the native platforms:</p>
            <CodeBlock>{`npm run build
npx cap add ios
npx cap add android`}</CodeBlock>
          </StepCard>

          <StepCard number={3} icon={MapPin} title="Install the background-geolocation plugin">
            <p>
              The recommended plugin is <strong>@transistorsoft/capacitor-background-geolocation</strong>
              — the industry-standard native background tracker (paid licence per platform, but
              the most reliable). A free alternative is
              <strong> @capacitor-community/background-geolocation</strong> (less reliable, no
              foreground notification on iOS).
            </p>
            <CodeBlock>{`# Recommended (paid licence — most reliable)
npm install @transistorsoft/capacitor-background-geolocation
npm install @transistorsoft/capacitor-background-fetch

# OR free alternative (less reliable)
npm install @capacitor-community/background-geolocation`}</CodeBlock>
            <p>Then sync the native projects:</p>
            <CodeBlock>{`npx cap sync`}</CodeBlock>
          </StepCard>

          <StepCard number={4} icon={Apple} title="Configure iOS permissions (Info.plist)">
            <p>
              Open <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">ios/App/App/Info.plist</code>
              and add the required location permission strings. iOS requires
              <strong>"Always"</strong> authorisation for background tracking.
            </p>
            <CodeBlock>{`<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>GC Mission Control tracks your location during working hours to automate timesheets and site arrival detection.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>GC Mission Control uses your location to show your position on the live tracking map.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
</array>`}</CodeBlock>
            <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>iOS tip:</strong> The plugin shows a persistent "Location tracking active"
                notification while tracking — this is required by iOS for background location
                and cannot be removed.
              </p>
            </div>
          </StepCard>

          <StepCard number={5} icon={Smartphone} title="Configure Android permissions (AndroidManifest.xml)">
            <p>
              Open <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">android/app/src/main/AndroidManifest.xml</code>
              and add the background location permission.
            </p>
            <CodeBlock>{`<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`}</CodeBlock>
            <p>
              Android 10+ requires the user to grant background location separately. The plugin
              will prompt for this — the user must select "Allow all the time".
            </p>
          </StepCard>

          <StepCard number={6} icon={Code} title="The runtime detection (already in the app)">
            <p>
              The app's <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">useStaffTracking</code> hook
              already detects the Capacitor native runtime at startup. When
              <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">window.Capacitor.isNative</code> is
              true and the plugin is importable, it calls <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">plugin.configure()</code>
              with the <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">recordStaffLocation</code> endpoint URL,
              the user's auth token (read from <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">localStorage</code>),
              and a sensible accuracy / distance-filter config, then starts the plugin. No code change is needed —
              the hook falls back to <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">navigator.geolocation</code> automatically when the plugin isn't present (the standard Base44 web build).
            </p>
            <p className="mt-2">The configured endpoint is:</p>
            <CodeBlock>{`POST https://gc-mission-control.base44.app/functions/recordStaffLocation
Authorization: Bearer <base44_access_token>
Content-Type: application/json

{
  "points": [{ "lat": 52.4, "lng": -1.5, "accuracy_m": 8, "recorded_at": "2026-09-04T08:00:00Z", "is_moving": true }],
  "assignment_id": "<today's RotaAssignment id>",
  "staff_name": "Kevin Price"
}`}</CodeBlock>
            <p className="mt-2">
              The existing <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">recordStaffLocation</code> backend function
              already accepts this payload shape — <strong>no backend change is needed</strong>.
            </p>
          </StepCard>

          <StepCard number={7} icon={ShieldCheck} title="Respect the staff tracking_enabled toggle">
            <p>
              The native plugin runs independently of the webview. When a staff member turns off
              tracking in their profile (<code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">tracking_enabled = false</code>),
              the app must stop the plugin. The <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">useStaffTracking</code> hook
              already calls <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">plugin.stop()</code> when
              <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">shouldTrack</code> becomes false. However, if the app is
              closed at the time, the plugin continues until the next app open. For a hard stop, add a
              <code className="px-1 py-0.5 rounded bg-slate-100 text-xs font-mono">plugin.setConfig({{ enabled: false }})</code> call
              in the profile tracking-settings screen when the toggle is flipped off.
            </p>
          </StepCard>

          <StepCard number={8} icon={Rocket} title="Build & submit to app stores">
            <p>Build the native bundles:</p>
            <CodeBlock>{`npx cap sync
npx cap open ios    # opens Xcode — build & archive for App Store
npx cap open android # opens Android Studio — build AAB for Play Store`}</CodeBlock>
            <p>
              Submit through your own Apple App Store Connect and Google Play Console accounts.
              Both stores require a privacy policy disclosing background location use. Google Play
              requires you to fill in the "Background location" data-safety declaration.
            </p>
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <p className="text-xs text-rose-800">
                <strong>Important:</strong> Do NOT use Base44's built-in "Generate IPA/AAB" flow for this
                build — that produces the standard webview wrapper which cannot do background location.
                You must build from the Capacitor project you created in Step 2.
              </p>
            </div>
          </StepCard>
        </div>

        {/* Checklist */}
        <div className="insight-card rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#2E5A1A]" />
            Pre-submission checklist
          </h2>
          <div className="space-y-2">
            {[
              'Capacitor project initialised with exported Base44 code',
              'Background-geolocation plugin installed and synced',
              'iOS Info.plist has NSLocationAlwaysAndWhenInUseUsageDescription + UIBackgroundModes',
              'Android AndroidManifest.xml has ACCESS_BACKGROUND_LOCATION',
              'App builds and runs on a physical device (simulators don\'t support background location)',
              'Background tracking verified with app fully closed for 30+ minutes',
              'Privacy policy updated to disclose background location',
              'Google Play data-safety form filled in (background location declared)',
              'Staff tracking_enabled toggle correctly stops the plugin',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle proxy note */}
        <div className="insight-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-100 flex-shrink-0">
              <Truck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Already working: Vehicle GPS proxy</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                While the native build is being set up, the Tracking Hub already shows crew
                members who are in company vehicles via the <strong>Geotab vehicle proxy</strong>.
                When a staff member has no recent phone GPS but has an assigned vehicle with a
                recent Geotab position, their pin appears on the map with a dashed border and a
                "via vehicle" label. This covers driving time immediately — no native build needed.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            GC Mission Control · Background Tracking Setup Guide · {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  );
}