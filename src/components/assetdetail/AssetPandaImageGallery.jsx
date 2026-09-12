import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Camera, X, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Upload, Trash2, Loader2 } from 'lucide-react';

/**
 * Asset Panda image gallery — thumbnail strip with a count badge, a
 * full-screen lightbox, and push-back upload/delete. Fetches images via
 * the getAssetPandaImages backend function (which caches them on the
 * SiteAsset record). Uploads/deletes flow through pushAssetPhotoToPanda
 * so changes are written back to Asset Panda and the cache refreshes.
 * Shown only when the asset has a panda_asset_id.
 */
export default function AssetPandaImageGallery({ asset }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const hasPandaId = !!asset?.panda_asset_id;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['asset-panda-images', asset?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssetPandaImages', { site_asset_id: asset.id });
      return res.data;
    },
    enabled: hasPandaId,
    staleTime: 5 * 60 * 1000,
  });

  const images = Array.isArray(data?.images) ? data.images : [];

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['asset-panda-images', asset?.id] });
    await queryClient.invalidateQueries({ queryKey: ['asset-detail', asset?.id] });
    await queryClient.invalidateQueries({ queryKey: ['site-assets'] });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Pass the File object straight to functions.invoke — the SDK sends it
      // as multipart/form-data (no UploadFile integration, which is unreliable
      // on the published site) and the backend reads it via req.formData().
      const pushRes = await base44.functions.invoke('pushAssetPhotoToPanda', {
        site_asset_id: asset.id, action: 'upload', file, file_name: file.name,
      });
      const d = pushRes.data || {};
      if (d.success === false) {
        toast({ title: 'Upload failed', description: d.error || 'Asset Panda rejected the photo', variant: 'destructive' });
      } else {
        toast({ title: 'Photo uploaded', description: 'Pushed to Asset Panda.' });
        await invalidateAll();
      }
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (img) => {
    if (!img?.id) {
      toast({ title: 'Cannot delete', description: 'No attachment ID cached — refresh from Panda first.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Delete "${img.name || 'this photo'}" from Asset Panda?`)) return;
    setDeletingId(img.id);
    try {
      const res = await base44.functions.invoke('pushAssetPhotoToPanda', {
        site_asset_id: asset.id, action: 'delete', attachment_id: img.id,
      });
      const d = res.data || {};
      if (d.success === false) {
        toast({ title: 'Delete failed', description: d.error || 'Asset Panda rejected the delete', variant: 'destructive' });
      } else {
        toast({ title: 'Photo deleted', description: 'Removed from Asset Panda.' });
        await invalidateAll();
      }
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  // Keyboard navigation in the lightbox.
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);
  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i + 1) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

  if (!hasPandaId) return null;

  return (
    <>
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#2E5A1A]" /> Asset Panda Photos
            {images.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2E5A1A] text-white text-[11px] font-bold">
                {images.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#2E5A1A] hover:bg-[#244715] px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition"
              title="Upload a new photo to Asset Panda"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#2E5A1A] disabled:opacity-50 transition"
              title="Refresh from Asset Panda"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Loading shimmer */}
        {(isLoading || isFetching) && images.length === 0 && (
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-24 h-24 rounded-xl bg-slate-100 shimmer" />
            ))}
          </div>
        )}

        {/* Error state — show only if we have no images at all */}
        {isError && images.length === 0 && !isFetching && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Couldn't load photos from Asset Panda.{' '}
              <button onClick={() => refetch()} className="font-semibold underline">Try again</button>
            </p>
          </div>
        )}

        {/* Empty state — still offer upload */}
        {!isLoading && !isFetching && !isError && images.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Camera className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs text-slate-400 mb-3">No photos in Asset Panda yet.</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#244715] disabled:opacity-50 transition"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload a photo
            </button>
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {images.map((img, i) => (
              <div
                key={img.id || i}
                className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 hover:border-[#2E5A1A] hover:shadow-md transition group relative"
              >
                <button
                  onClick={() => setLightboxIndex(i)}
                  className="block w-full h-full"
                >
                  <img
                    src={img.thumb || img.medium || img.url}
                    alt={img.name || `Asset photo ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                  disabled={deletingId === img.id}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-60"
                  title="Delete from Asset Panda"
                >
                  {deletingId === img.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex != null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); showPrev(); }}
                className="absolute left-2 sm:left-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                className="absolute right-2 sm:right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <figure
            className="max-w-[92vw] max-h-[88vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex].large || images[lightboxIndex].url}
              alt={images[lightboxIndex].name || `Asset photo ${lightboxIndex + 1}`}
              className="max-w-[92vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <figcaption className="mt-3 text-xs text-white/80 font-medium text-center max-w-full truncate">
              {images[lightboxIndex].name || `Photo ${lightboxIndex + 1} of ${images.length}`}
              <span className="mx-1.5 opacity-50">·</span>
              {lightboxIndex + 1} / {images.length}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}