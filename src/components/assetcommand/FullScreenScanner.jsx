import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Keyboard, AlertTriangle, ScanLine, Loader2, WifiOff, Zap, CheckCircle2 } from 'lucide-react';
import ScanResultPopup from './ScanResultPopup';
import useBackIntercept from '@/hooks/useBackIntercept';

/**
 * Full-screen camera scanner overlay — premium visual overhaul.
 *
 * New reticle: rounded-square frame with animated gradient border, breathing
 * corner brackets, and a refined scan beam. On-screen guidance hints change
 * based on state (idle → scanning → found → cooldown). A success flash + haptic
 * pulse fires on detection. Preserves camera lifecycle, BarcodeDetector loop,
 * torch toggle, and manual entry fallback.
 *
 * Props:
 *   onScan(val)       — called with every detected code (parent resolves it)
 *   onClose()         — close the viewfinder
 *   resolving         — true while parent is resolving the last scan
 *   scanResult        — last resolved SiteAsset (shown in popup)
 *   scanError         — last scan value that failed to resolve
 *   pendingPanda      — Panda confirm data (new-asset path)
 *   alreadyInBasket   — true if scanResult is already in the basket
 *   confirming        — true while Panda link is being confirmed
 *   refreshing        — true while background Panda refresh is in flight
 *   onViewAsset(a)    — open the Asset Command Drawer for this asset
 *   onScanNext()      — dismiss popup, ready for next scan
 *   onAddToBasket(a)  — add asset to basket, then scan next
 *   onConfirmPanda()  — confirm Panda link
 *   onCancelPanda()   — cancel Panda confirm
 */
export default function FullScreenScanner({
  onScan, onClose,
  resolving, scanResult, scanError, pendingPanda, alreadyInBasket,
  confirming, refreshing,
  onViewAsset, onScanNext, onAddToBasket, onConfirmPanda, onCancelPanda,
  extraActions = [],
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const flashTimerRef = useRef(null);

  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useBackIntercept(true, onClose);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    setCooldown(false);
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Reset the scan cooldown whenever the popup is cleared (Scan Next / Add to
  // Basket) so the scanner is immediately ready for the next barcode.
  useEffect(() => {
    if (!scanResult && !scanError && !pendingPanda && !resolving) {
      if (cooldownTimerRef.current) { clearTimeout(cooldownTimerRef.current); cooldownTimerRef.current = null; }
      setCooldown(false);
    }
  }, [scanResult, scanError, pendingPanda, resolving]);

  // Fire success flash + haptic when a result arrives
  useEffect(() => {
    if (scanResult && !alreadyInBasket) {
      setFlashOn(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashOn(false), 600);
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    } else if (scanError) {
      if (navigator.vibrate) navigator.vibrate(120);
    }
  }, [scanResult, scanError, alreadyInBasket]);

  const detectLoop = useCallback(async () => {
    if (!streamRef.current || !videoRef.current) return;
    if (cooldown) { rafRef.current = requestAnimationFrame(detectLoop); return; }
    if (detectorRef.current && videoRef.current.readyState >= 2) {
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length > 0) {
          const val = codes[0].rawValue || '';
          if (val) {
            onScan(val);
            setCooldown(true);
            if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
            cooldownTimerRef.current = setTimeout(() => setCooldown(false), 1500);
          }
        }
      } catch (_) { /* transient */ }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [cooldown, onScan]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const settings = track.getSettings ? track.getSettings() : {};

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (caps.torch) setTorchSupported(true);
      if (caps.zoom && caps.zoom.min != null) {
        try { await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }); } catch (_) {}
      }
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (_) {}
      }
      setCameraActive(true);
      if (hasNativeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
          });
        } catch (_) { detectorRef.current = new window.BarcodeDetector(); }
        detectLoop();
      } else {
        setShowManual(true);
      }
    } catch (err) {
      setCameraError(err.message || 'Could not access camera');
      setShowManual(true);
    }
  }, [detectLoop, hasNativeDetector]);

  useEffect(() => { startCamera(); }, [startCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (_) {}
  }, [torchOn]);

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const val = manualValue.trim();
    if (!val) return;
    onScan(val);
    setManualValue('');
  };

  // Guidance state
  const hasPopup = resolving || scanResult || scanError || pendingPanda;
  const guidance = cooldown
    ? { text: 'Scanned — wait a moment', tone: 'amber' }
    : hasPopup
      ? { text: 'Found! Review below', tone: 'emerald' }
      : !cameraActive
        ? { text: 'Starting camera…', tone: 'slate' }
        : { text: 'Point at any QR or barcode', tone: 'white' };

  const toneClasses = {
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    slate: 'text-slate-400',
    white: 'text-white/80',
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: '#000' }}>
      {/* Camera video — full bleed */}
      <div className="absolute inset-0">
        <video ref={videoRef} playsInline muted autoPlay
          className="w-full h-full object-cover"
          style={{ transform: 'translateZ(0)', backgroundColor: '#000' }} />
      </div>

      {/* Success flash overlay — emerald pulse on detection */}
      {flashOn && (
        <div className="absolute inset-0 z-[5] pointer-events-none animate-flash-success" />
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Scanning…</p>
            <p className="text-white/50 text-[11px]">Asset Scanner</p>
          </div>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 transition border border-white/15"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Reticle — centered with new modern frame */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <div className="relative w-[72vw] h-[48vh] max-w-[400px] max-h-[400px]">
          {/* Outer glow ring — subtle emerald aura */}
          <div className="absolute -inset-6 rounded-[2.5rem] bg-emerald-400/8 blur-2xl" />

          {/* Main frame — rounded square with gradient border */}
          <div className="absolute inset-0 rounded-[2rem] border-2 border-white/20" />

          {/* Animated gradient border — subtle rotating glow */}
          <div className="absolute inset-0 rounded-[2rem] border-2 border-transparent animate-border-glow" />

          {/* Corner brackets — refined, breathing */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-emerald-300 rounded-tl-[2rem] animate-bracket-pulse" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-emerald-300 rounded-tr-[2rem] animate-bracket-pulse" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-emerald-300 rounded-bl-[2rem] animate-bracket-pulse" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-emerald-300 rounded-br-[2rem] animate-bracket-pulse" />

          {/* Laser scan beam — refined gradient with glow */}
          {!cooldown && cameraActive && !hasPopup && (
            <div className="absolute left-4 right-4 animate-[scanbeam_2.8s_ease-in-out_infinite]">
              {/* Glow trail */}
              <div className="h-8 -translate-y-4 bg-gradient-to-b from-transparent via-emerald-400/20 to-transparent blur-md" />
              {/* Core beam */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_12px_3px_rgba(16,185,129,0.6)]" />
            </div>
          )}

          {/* Cooldown checkmark — success state */}
          {cooldown && !hasPopup && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center animate-pop-in">
                <CheckCircle2 className="w-9 h-9 text-emerald-300" />
              </div>
            </div>
          )}

          {/* Center crosshair — subtle target dot */}
          {!cooldown && !hasPopup && cameraActive && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
          )}
        </div>

        {/* Guidance text — state-aware */}
        <div className="mt-6 flex items-center gap-2 px-4">
          <div className={`w-2 h-2 rounded-full ${
            guidance.tone === 'emerald' ? 'bg-emerald-400 animate-pulse' :
            guidance.tone === 'amber' ? 'bg-amber-400' :
            guidance.tone === 'slate' ? 'bg-slate-500' :
            'bg-white/60'
          }`} />
          <p className={`text-sm font-semibold ${toneClasses[guidance.tone]}`}>
            {guidance.text}
          </p>
        </div>
      </div>

      {/* Scan result popup — bottom sheet over the live camera */}
      <ScanResultPopup
        resolving={resolving}
        scanResult={scanResult}
        scanError={scanError}
        pendingPanda={pendingPanda}
        alreadyInBasket={alreadyInBasket}
        confirming={confirming}
        refreshing={refreshing}
        onViewAsset={onViewAsset}
        onScanNext={onScanNext}
        onAddToBasket={onAddToBasket}
        onConfirmPanda={onConfirmPanda}
        onCancelPanda={onCancelPanda}
        extraActions={extraActions}
      />

      {/* Bottom controls */}
      <div className="relative z-10 px-4 pb-6 safe-area-bottom">
        {cameraError && !cameraActive && (
          <div className="flex items-center gap-2 bg-amber-500/20 rounded-xl px-4 py-2.5 mb-3 border border-amber-400/40 backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <p className="text-white/90 text-xs flex-1">{cameraError}</p>
          </div>
        )}
        {showManual ? (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                placeholder="Type barcode…"
                autoFocus
                className="w-full pl-11 pr-4 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-base font-medium text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <button type="submit" disabled={!manualValue.trim()} className="px-5 py-3.5 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition">
              Add
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold active:scale-95 transition backdrop-blur-md border ${
                  torchOn
                    ? 'bg-amber-400 text-amber-950 border-amber-300'
                    : 'bg-white/10 text-white border-white/15'
                }`}
              >
                <Zap className="w-4 h-4" /> {torchOn ? 'Torch On' : 'Torch'}
              </button>
            )}
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl text-sm font-semibold active:scale-95 transition border border-white/15"
            >
              <Keyboard className="w-4 h-4" /> Manual
            </button>
            {!hasNativeDetector && (
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <WifiOff className="w-3.5 h-3.5" /> Live detect unsupported
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanbeam { 0%,100% { top: 8%; } 50% { top: 92%; } }
        @keyframes bracket-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .animate-bracket-pulse { animation: bracket-pulse 2s ease-in-out infinite; }
        @keyframes border-glow {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(16,185,129,0.15); }
          50% { box-shadow: 0 0 30px 4px rgba(16,185,129,0.25); }
        }
        .animate-border-glow { animation: border-glow 3s ease-in-out infinite; }
        @keyframes flash-success {
          0% { background: rgba(16,185,129,0); }
          30% { background: rgba(16,185,129,0.25); }
          100% { background: rgba(16,185,129,0); }
        }
        .animate-flash-success { animation: flash-success 0.6s ease-out; }
      `}</style>
    </div>
  );
}