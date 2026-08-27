import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw } from 'lucide-react';

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  // Downscale large source images so the intermediate canvas stays well
  // within browser canvas size limits. Hitting the limit makes toBlob
  // silently return null, which hangs the cropper — the "bugs out"
  // profile-photo issue.
  const MAX_DIM = 1280;
  const scale = Math.min(1, MAX_DIM / Math.max(image.width, image.height));
  const iw = image.width * scale;
  const ih = image.height * scale;
  const crop = {
    x: pixelCrop.x * scale,
    y: pixelCrop.y * scale,
    width: pixelCrop.width * scale,
    height: pixelCrop.height * scale,
  };

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(iw, ih);
  const safeArea = 2 * Math.round(maxSize / 2);
  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-iw / 2, -ih / 2);
  ctx.drawImage(image, 0, 0, iw, ih);

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + iw / 2 - crop.x),
    Math.round(0 - safeArea / 2 + ih / 2 - crop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      resolve(new File([blob], 'cropped.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  });
}

export default function ImageCropper({ imageSrc, aspect = 1.586, onConfirm, onCancel, title = 'Crop Image' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const file = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      if (file) onConfirm(file);
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-slate-900" style={{ height: '320px' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 flex-shrink-0 w-12">Zoom</span>
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-600" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 flex-shrink-0 w-12">Rotate</span>
            <input type="range" min={0} max={360} step={1} value={rotation} onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-emerald-600" />
            <button type="button" onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
              <Check className="w-4 h-4" /> {processing ? 'Processing…' : 'Confirm Crop'}
            </button>
            <button onClick={onCancel}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}