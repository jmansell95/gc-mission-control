import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge, Clock } from 'lucide-react';

const SPEED_OPTIONS = [1, 2, 4, 8];

/**
 * TripPlaybackScrubber — timeline slider that animates a vehicle marker
 * along its breadcrumb trail. Supports play/pause, adjustable speed
 * (1x/2x/4x/8x), and step-forward/back.
 *
 * @param {Array} breadcrumbs - sorted by timestamp, each with {lat,lng,timestamp}
 * @param {number} currentIndex - current playback index (controlled by parent)
 * @param {function} onIndexChange - called when the playback index changes
 */
export default function TripPlaybackScrubber({ breadcrumbs, currentIndex, onIndexChange }) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const intervalRef = useRef(null);

  const total = breadcrumbs?.length || 0;
  const hasData = total > 1;

  // Auto-advance the index while playing
  useEffect(() => {
    if (!playing || !hasData) return;
    intervalRef.current = setInterval(() => {
      onIndexChange(prev => {
        if (prev >= total - 1) {
          setPlaying(false);
          return total - 1;
        }
        return prev + 1;
      });
    }, 600 / speed); // faster speed = shorter interval
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, hasData, total, onIndexChange]);

  // Reset playback when breadcrumbs change
  useEffect(() => {
    setPlaying(false);
  }, [breadcrumbs]);

  if (!hasData) {
    return (
      <div className="hub-glass rounded-xl p-3 text-center">
        <Clock className="w-5 h-5 text-slate-300 mx-auto mb-1" />
        <p className="text-xs text-slate-400">No breadcrumb data for playback</p>
      </div>
    );
  }

  const current = breadcrumbs[currentIndex] || breadcrumbs[0];
  const startTime = breadcrumbs[0]?.timestamp;
  const endTime = breadcrumbs[total - 1]?.timestamp;
  const currentTime = current?.timestamp;
  const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <div className="hub-glass rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Gauge className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-xs font-bold text-slate-800">Trip Playback</h4>
        <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtTime(startTime)}</span>
        <span className="font-bold text-primary">{fmtTime(currentTime)}</span>
        <span className="flex items-center gap-1">{fmtTime(endTime)} <Clock className="w-3 h-3" /></span>
      </div>

      {/* Scrubber slider */}
      <input
        type="range"
        min={0}
        max={total - 1}
        value={currentIndex}
        onChange={(e) => { setPlaying(false); onIndexChange(Number(e.target.value)); }}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#2E5A1A]"
        style={{
          background: `linear-gradient(to right, #2E5A1A ${progress}%, #e2e8f0 ${progress}%)`,
        }}
      />

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setPlaying(false); onIndexChange(0); }}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          title="Jump to start"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg command-gradient text-white font-bold text-xs hover:opacity-90 transition"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => { setPlaying(false); onIndexChange(total - 1); }}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          title="Jump to end"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 font-semibold uppercase">Speed</span>
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                speed === s ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}