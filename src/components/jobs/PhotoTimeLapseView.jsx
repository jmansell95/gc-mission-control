import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, Pause, Camera, Calendar, MapPin } from 'lucide-react';

/**
 * PhotoTimeLapseView — shows site photos in chronological order with a
 * slider scrubber and auto-play. Useful for visualising site progress
 * over time. Reads SitePhoto records for a job sorted by date.
 */
export default function PhotoTimeLapseView({ jobId }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['job-photos-timelapse', jobId],
    queryFn: () => jobId ? base44.entities.SitePhoto.filter({ job_id: jobId }) : [],
    enabled: !!jobId,
  });

  const sorted = useMemo(() =>
    photos
      .filter(p => p.photo_url)
      .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || '')),
    [photos]
  );

  useEffect(() => {
    if (playing && sorted.length > 1) {
      timerRef.current = setInterval(() => {
        setIndex(i => (i + 1) % sorted.length);
      }, 1500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, sorted.length]);

  useEffect(() => { setIndex(0); }, [jobId]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Camera className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">No site photos yet</p>
        <p className="text-xs text-slate-400 mt-0.5">Upload photos from the job to see a time-lapse of progress</p>
      </div>
    );
  }

  const current = sorted[Math.min(index, sorted.length - 1)];

  return (
    <div className="space-y-3">
      {/* Main photo */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
        <img src={current.photo_url} alt="Site photo" className="w-full h-full object-cover" />
        {/* Overlay info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="flex items-center gap-3 text-white text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {current.created_date ? new Date(current.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </span>
            {current.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {current.location}
              </span>
            )}
            {current.caption && <span className="truncate">{current.caption}</span>}
          </div>
        </div>
        {/* Photo counter */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {index + 1} / {sorted.length}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying(p => !p)}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition flex-shrink-0"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={sorted.length - 1}
          value={index}
          onChange={(e) => { setIndex(Number(e.target.value)); setPlaying(false); }}
          className="flex-1 accent-[#2E5A1A]"
        />
        <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
          {sorted.length} photo{sorted.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Thumbnail strip */}
      {sorted.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {sorted.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setIndex(i); setPlaying(false); }}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}