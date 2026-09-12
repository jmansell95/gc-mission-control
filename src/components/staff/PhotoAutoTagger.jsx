import React, { useState, useRef, useCallback } from 'react';
import { Camera, MapPin, Calendar, Loader2, Tag, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Photo Capture with Auto-Tagging — captures a photo (camera or file upload),
// auto-tags it with job, date, GPS, and equipment using on-device AI
// (InvokeLLM vision), and uploads it to the SitePhoto entity.

export default function PhotoAutoTagger({ jobId, jobName, onUploaded }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileObj, setFileObj] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [tags, setTags] = useState({});
  const [gps, setGps] = useState(null);

  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileObj(file);
    setPreview(URL.createObjectURL(file));
    setTags({});
    captureGPS();
    autoTag(file);
  };

  const autoTag = async (file) => {
    setTagging(true);
    try {
      // Upload file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setTags(prev => ({ ...prev, file_url }));

      // Use InvokeLLM with vision to auto-tag the photo
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyse this construction/site photo and identify: 1) What equipment or machinery is visible (rigs, vans, tools), 2) What work activity is happening (drilling, groundworks, coring), 3) Site conditions (mud, weather, terrain), 4) Any safety equipment visible (PPE, barriers). Return as structured JSON.`,
        file_urls: [file_url],
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

      setTags(prev => ({
        ...prev,
        equipment: res?.equipment || [],
        activity: res?.activity || '',
        conditions: res?.conditions || '',
        safety_visible: res?.safety_visible,
        suggested_caption: res?.suggested_caption || '',
      }));
    } catch (err) {
      // Auto-tagging failed — user can still upload manually
    } finally {
      setTagging(false);
    }
  };

  const save = async () => {
    if (!tags.file_url) return;
    setUploading(true);
    try {
      const photo = await base44.entities.SitePhoto.create({
        job_id: jobId,
        job_name: jobName,
        photo_url: tags.file_url,
        caption: tags.suggested_caption || '',
        tags: tags.equipment?.join(', ') || '',
        activity: tags.activity || '',
        conditions: tags.conditions || '',
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        captured_at: new Date().toISOString(),
      });
      toast({ title: '✓ Photo uploaded with auto-tags' });
      onUploaded?.(photo);
      // Reset
      setPreview(null);
      setFileObj(null);
      setTags({});
      setGps(null);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-slate-800 text-sm">Photo Capture & Auto-Tagging</h3>
      </div>

      {!preview ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl py-8 cursor-pointer hover:bg-slate-50 transition">
          <Camera className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">Take Photo or Upload</p>
          <p className="text-xs text-slate-400 mt-0.5">Auto-tags with AI vision: equipment, activity, conditions</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        </label>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full rounded-xl max-h-48 object-cover" />
            <button onClick={() => { setPreview(null); setFileObj(null); setTags({}); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-tags */}
          {tagging ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>AI analyzing photo…</span>
            </div>
          ) : tags.suggested_caption ? (
            <div className="space-y-2">
              {/* Auto-generated caption */}
              <div className="bg-emerald-50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag className="w-3 h-3 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">AI Caption</span>
                </div>
                <p className="text-xs text-slate-700">{tags.suggested_caption}</p>
              </div>

              {/* Equipment tags */}
              {tags.equipment?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.equipment.map((eq, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{eq}</span>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {tags.activity && <span>📋 {tags.activity}</span>}
                {gps && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> GPS captured</span>}
                <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          ) : null}

          {/* Save button */}
          <button onClick={save} disabled={!tags.file_url || uploading || tagging}
            className="w-full py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Save Photo'}
          </button>
        </div>
      )}
    </div>
  );
}