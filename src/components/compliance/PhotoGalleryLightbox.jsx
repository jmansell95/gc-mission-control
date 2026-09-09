import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ImageOff } from 'lucide-react';

/**
 * PhotoGalleryLightbox — shared component for viewing audit photos.
 * Shows a thumbnail strip; clicking any thumbnail opens a full-screen
 * lightbox with zoom and arrow-key navigation between all photos.
 */
export default function PhotoGalleryLightbox({ photos = [], label = 'Photos' }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  const isOpen = lightboxIndex !== null;

  const close = useCallback(() => { setLightboxIndex(null); setZoomed(false); }, []);
  const next = useCallback(() => {
    setZoomed(false);
    setLightboxIndex(prev => (prev === null ? null : (prev + 1) % photos.length));
  }, [photos.length]);
  const prev = useCallback(() => {
    setZoomed(false);
    setLightboxIndex(prev => (prev === null ? null : (prev - 1 + photos.length) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, next, prev]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex gap-1.5 flex-wrap">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightboxIndex(i)}
            className="relative block group"
          >
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="w-14 h-14 rounded-lg object-cover border border-slate-200 group-hover:opacity-80 group-hover:border-[#2E5A1A]/40 transition"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </button>
        ))}
      </div>

      {/* Full-screen lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-md flex items-center justify-center"
          onClick={close}
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-white/10 text-white text-sm font-semibold z-10">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Zoom toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition z-10"
          >
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          {/* Navigation arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={photos[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            className={`max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-300 ${zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'flex flex-col items-center text-slate-400';
              fallback.innerHTML = '<div class="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-3"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg></div><p>Image could not load</p>';
              e.currentTarget.parentNode?.appendChild(fallback);
            }}
          />
        </div>
      )}
    </>
  );
}