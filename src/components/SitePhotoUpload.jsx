import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, X, Trash2, Loader2, Tag, Sparkles, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function SitePhotoUpload({ jobId, staffName }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [caption, setCaption] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [autoTagging, setAutoTagging] = useState(true);
  const [taggingStatus, setTaggingStatus] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: photos = [] } = useQuery({
    queryKey: ['site-photos', jobId],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: jobId }, '-created_date', 200),
    enabled: !!jobId
  });

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
    if (!files.length || !jobId) return;
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
          job_id: jobId,
          photo_url: file_url,
          caption: caption || aiCaption || '',
          tags,
          activity,
          conditions,
          gps_lat: gps?.lat || null,
          gps_lng: gps?.lng || null,
          uploaded_by_name: staffName || '',
          captured_at: new Date().toISOString(),
        });
        setProgress({ done: i + 1, total: files.length });
      }
      setCaption('');
      setShowForm(false);
      setTaggingStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['site-photos', jobId] });
      toast({ title: autoTagging ? '✓ Photos uploaded with AI tags' : '✓ Photos uploaded' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
    setUploading(false);
    setTaggingStatus('');
  };

  const handleDelete = async (id) => {
    await base44.entities.SitePhoto.delete(id);
    queryClient.invalidateQueries({ queryKey: ['site-photos', jobId] });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Camera className="w-4 h-4 text-emerald-600" /> Site Photos
          {photos.length > 0 && <span className="text-xs font-medium text-slate-400">({photos.length})</span>}
        </div>
        <span className="text-[11px] text-slate-400">Optional</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map(p => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
              <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover" />
              {p.tags && (
                <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-emerald-600/90 text-white text-[8px] px-1 py-0.5 rounded-full font-bold uppercase">
                  <Sparkles className="w-2 h-2" /> AI
                </div>
              )}
              <button onClick={() => handleDelete(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600">
                <Trash2 className="w-3 h-3" />
              </button>
              {p.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">{p.caption}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          {/* Auto-tag toggle */}
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
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
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploading ? `Processing ${progress.done}/${progress.total}…` : 'Choose Photos'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={uploading}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium disabled:opacity-50">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {autoTagging
              ? 'Photos are auto-tagged with AI vision: equipment, activity, site conditions, and GPS. Auto-generated captions save you typing.'
              : 'Select multiple photos at once and upload them any time before you submit your timesheet.'}
          </p>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium w-full sm:w-auto">
          <Camera className="w-4 h-4" /> {photos.length > 0 ? 'Add More Photos' : 'Add Site Photos'}
        </button>
      )}
    </div>
  );
}