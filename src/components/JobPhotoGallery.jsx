import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera, Trash2, X, ChevronLeft, ChevronRight, Film,
  Upload, Loader2, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import PhotoTimeLapseView from '@/components/jobs/PhotoTimeLapseView';

export default function JobPhotoGallery({ job, canUpload }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showTimeLapse, setShowTimeLapse] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [caption, setCaption] = useState('');
  const [autoTagging, setAutoTagging] = useState(true);
  const [taggingStatus, setTaggingStatus] = useState('');
  const fileInputRef = useRef(null);

  const staffName = user?.full_name || user?.email || 'Manager';

  const { data: photos = [] } = useQuery({
    queryKey: ['site-photos', job.id],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: job.id }, '-created_date', 500),
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await base44.entities.SitePhoto.delete(id);
      queryClient.invalidateQueries({ queryKey: ['site-photos', job.id] });
      setLightboxIdx(null);
    } catch (e) { console.error(e); }
    setDeletingId(null);
  };

  const captureGPS = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const autoTagPhoto = async (fileUrl) => {
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyse this construction/site photo and identify: 1) What equipment or machinery is visible (rigs, vans, tools), 2) What work activity is happening (drilling, groundworks, coring), 3) Site conditions (mud, weather, terrain), 4) Any safety equipment visible (PPE, barriers). Return as structured JSON.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            equipment: { type: 'array', items: { type: 'string' } },
            activity: { type: 'string' },
            conditions: { type: 'string' },
            safety_visible: { type: 'boolean' },
            suggested_caption: { type: 'string' },
          },
        },
      });
      return res;
    } catch (err) {
      console.error('Auto-tag failed:', err);
      return null;
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !job.id) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    try {
      const gps = autoTagging ? await captureGPS() : null;
      for (let i = 0; i < files.length; i++) {
        setTaggingStatus(`Uploading ${i + 1} of ${files.length}…`);
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: files[i] });

        let tags = '';
        let activity = '';
        let conditions = '';
        let aiCaption = '';

        if (autoTagging) {
          setTaggingStatus(`AI tagging photo ${i + 1}…`);
          const aiTags = await autoTagPhoto(file_url);
          if (aiTags) {
            tags = (aiTags.equipment || []).join(', ');
            activity = aiTags.activity || '';
            conditions = aiTags.conditions || '';
            aiCaption = aiTags.suggested_caption || '';
          }
        }

        await base44.entities.SitePhoto.create({
          job_id: job.id,
          photo_url: file_url,
          caption: caption || aiCaption || '',
          tags,
          activity,
          conditions,
          gps_lat: gps?.lat || null,
          gps_lng: gps?.lng || null,
          uploaded_by_name: staffName,
          captured_at: new Date().toISOString(),
        });
        setProgress({ done: i + 1, total: files.length });
      }
      setCaption('');
      setShowUpload(false);
      setTaggingStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['site-photos', job.id] });
      toast({ title: autoTagging ? '✓ Photos uploaded with AI tags' : '✓ Photos uploaded' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
    setUploading(false);
    setTaggingStatus('');
  };

  const closeLightbox = () => setLightboxIdx(null);
  const prev = () => setLightboxIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setLightboxIdx(i => (i + 1) % photos.length);
  const current = lightboxIdx != null ? photos[lightboxIdx] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Camera className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Site Photos</h3>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{photos.length}</span>
        {photos.length > 1 && (
          <button onClick={() => setShowTimeLapse(s => !s)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${showTimeLapse ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Film className="w-3.5 h-3.5" /> Time-Lapse
          </button>
        )}
        {canUpload && !showUpload && (
          <button onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-[#244715] transition">
            <Upload className="w-3.5 h-3.5" /> Add Photos
          </button>
        )}
      </div>
      {showTimeLapse && photos.length > 1 && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <PhotoTimeLapseView jobId={job.id} />
        </div>
      )}

      {/* Upload form */}
      {canUpload && showUpload && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <label className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg cursor-pointer">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-900">AI Auto-Tagging</p>
                <p className="text-[10px] text-emerald-700">Tags equipment, activity & conditions automatically</p>
              </div>
            </div>
            <button type="button" onClick={() => setAutoTagging(v => !v)}
              className={`relative w-9 h-5 rounded-full transition flex-shrink-0 ${autoTagging ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition ${autoTagging ? 'translate-x-4' : ''}`} />
            </button>
          </label>
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional, applied to all photos)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={handleUpload} className="hidden" />
          {taggingStatus && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {taggingStatus}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg hover:bg-[#244715] transition text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploading ? `Processing ${progress.done}/${progress.total}…` : 'Choose Photos'}
            </button>
            <button onClick={() => setShowUpload(false)} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium disabled:opacity-50">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">No photos uploaded for this job yet</div>
      ) : (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p, idx) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
              <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxIdx(idx)} />
              {p.tags && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-emerald-600/90 text-white text-[8px] px-1 py-0.5 rounded-full font-bold uppercase">
                  <Sparkles className="w-2 h-2" /> AI
                </div>
              )}
              <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600 disabled:opacity-50"
                title="Delete photo">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-1.5">
                {p.caption && <p className="text-[10px] text-white truncate">{p.caption}</p>}
                <p className="text-[9px] text-white/70 truncate">
                  {p.uploaded_by_name ? p.uploaded_by_name : ''}
                  {p.created_date ? ` · ${format(new Date(p.created_date), 'dd MMM')}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center overflow-y-auto overscroll-contain p-4" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
            <X className="w-5 h-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 md:left-6 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 md:right-6 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={current.photo_url} alt={current.caption || ''} className="max-w-full max-h-[78vh] object-contain rounded-lg" />
            <div className="mt-3 flex items-center justify-between gap-4 w-full max-w-2xl">
              <div className="min-w-0">
                {current.caption && <p className="text-sm text-white truncate">{current.caption}</p>}
                <p className="text-xs text-white/60">
                  {current.uploaded_by_name ? `Uploaded by ${current.uploaded_by_name}` : ''}
                  {current.created_date ? ` · ${format(new Date(current.created_date), 'dd MMM yyyy')}` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(current.id)} disabled={deletingId === current.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}