import React, { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Upload, X } from 'lucide-react';
import { BoundingBox, ImageQualityMetrics } from '../engine/localDiagnosticEngine';

export interface SampleFieldImage {
  id: string;
  label: string;
  src: string;
}

export const FIELD_SAMPLES: SampleFieldImage[] = [
  {
    id: 'sample_tomato_blight',
    label: 'Tomato Leaf Spots',
    src: '/src/assets/images/sample_tomato_blight_1795134091776.jpg',
  },
  {
    id: 'sample_maize_armyworm',
    label: 'Maize Whorl Pest',
    src: '/src/assets/images/sample_maize_armyworm_1795134091146.jpg',
  },
  {
    id: 'sample_rice_blast',
    label: 'Rice Blade Lesions',
    src: '/src/assets/images/sample_rice_blast_1795134091259.jpg',
  },
  {
    id: 'sample_mystery_leaf',
    label: 'Unfamiliar Gall Leaf',
    src: '/src/assets/images/sample_mystery_leaf_1795134091311.jpg',
  },
];

interface BoundingBoxViewportProps {
  imageSrc: string;
  activeSampleId?: string;
  box: BoundingBox;
  onBoxChange: (next: BoundingBox) => void;
  onImageSelected: (src: string, sampleId?: string) => void;
  onImageElementReady: (img: HTMLImageElement) => void;
  qualityMetrics: ImageQualityMetrics | null;
  compact?: boolean;
}

export const BoundingBoxViewport: React.FC<BoundingBoxViewportProps> = ({
  imageSrc,
  activeSampleId,
  box,
  onBoxChange,
  onImageSelected,
  onImageElementReady,
  qualityMetrics,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'se' | 'nw' | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startBox: BoundingBox } | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. Upload a photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraError('Camera permission declined or unavailable. Use Upload Photo or choose a sample below.');
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    closeCamera();
    onImageSelected(dataUrl, undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageSelected(reader.result, undefined);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const beginDrag = (mode: 'move' | 'se' | 'nw', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragMode(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startBox: { ...box },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - dragStartRef.current.clientX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.clientY) / rect.height;
    const start = dragStartRef.current.startBox;

    if (dragMode === 'move') {
      const nextX = Math.max(0.02, Math.min(0.98 - start.width, start.x + dx));
      const nextY = Math.max(0.02, Math.min(0.98 - start.height, start.y + dy));
      onBoxChange({ ...start, x: nextX, y: nextY });
    } else if (dragMode === 'se') {
      const nextW = Math.max(0.18, Math.min(0.98 - start.x, start.width + dx));
      const nextH = Math.max(0.18, Math.min(0.98 - start.y, start.height + dy));
      onBoxChange({ ...start, width: nextW, height: nextH });
    } else if (dragMode === 'nw') {
      const maxRight = start.x + start.width;
      const maxBottom = start.y + start.height;
      const nextX = Math.max(0.02, Math.min(maxRight - 0.18, start.x + dx));
      const nextY = Math.max(0.02, Math.min(maxBottom - 0.18, start.y + dy));
      onBoxChange({
        x: nextX,
        y: nextY,
        width: maxRight - nextX,
        height: maxBottom - nextY,
      });
    }
  };

  const endDrag = () => {
    setDragMode(null);
    dragStartRef.current = null;
  };

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {/* Action Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={cameraOpen ? closeCamera : openCamera}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#1B5E20] font-medium text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0 ${
              compact ? 'px-3 py-1.5 text-xs' : 'rounded-lg px-4 py-2 text-sm'
            }`}
          >
            {cameraOpen ? <X className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            {cameraOpen ? 'Close' : compact ? 'CameraX' : 'Open Camera'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`inline-flex min-h-[44px] items-center gap-1.5 border border-[#D4DBD0] bg-white font-medium text-[#182019] transition-colors hover:bg-[#F0F2ED] whitespace-nowrap shrink-0 ${
              compact ? 'rounded-full px-3 py-1.5 text-xs' : 'rounded-lg px-4 py-2 text-sm'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {compact ? 'Gallery' : 'Upload Photo'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => onBoxChange({ x: 0.16, y: 0.14, width: 0.68, height: 0.72 })}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-[#475449] hover:bg-[#EAECE6] whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {cameraError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {cameraError}
        </p>
      )}

      {/* Guided Framing Viewport */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative aspect-[4/3] w-full overflow-hidden border border-[#D4DBD0] bg-[#141A15] select-none touch-none ${
          compact ? 'rounded-2xl' : 'rounded-2xl'
        }`}
      >
        {cameraOpen ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Guided Bounding-Box Reticle in Camera View */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-full w-full max-w-[78%] max-h-[78%] rounded-xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]">
                <span className="absolute -top-5 left-0 text-[11px] font-medium text-white">
                  Frame affected part inside box
                </span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={captureFromCamera}
                className="min-h-[44px] rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#182019] shadow-lg active:scale-95"
              >
                Capture Frame
              </button>
            </div>
          </>
        ) : (
          <>
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop leaf or pest framing preview"
              referrerPolicy="no-referrer"
              onLoad={(e) => onImageElementReady(e.currentTarget)}
              className="h-full w-full object-cover"
            />

            {/* Dimmed outside-ROI overlay + Interactive Bounding Box */}
            <div
              onPointerDown={(e) => beginDrag('move', e)}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              className="absolute cursor-move rounded-lg border-2 border-emerald-300 shadow-[0_0_0_9999px_rgba(12,18,13,0.45)]"
            >
              {/* Top-left resize handle */}
              <button
                type="button"
                aria-label="Resize top-left bounding box corner"
                onPointerDown={(e) => beginDrag('nw', e)}
                className="absolute -left-2.5 -top-2.5 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-[#1B5E20] bg-white shadow"
              />
              {/* Bottom-right resize handle */}
              <button
                type="button"
                aria-label="Resize bottom-right bounding box corner"
                onPointerDown={(e) => beginDrag('se', e)}
                className="absolute -bottom-2.5 -right-2.5 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-[#1B5E20] bg-white shadow"
              />
              <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                ROI Frame (Drag)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Live Image Quality & Payload Metrics (Unboxed metadata per design constitution) */}
      {qualityMetrics && !cameraOpen && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#475449]">
          <span className="font-semibold text-[#182019]">
            {qualityMetrics.lightingStatus === 'well_lit'
              ? 'Well Lit'
              : qualityMetrics.lightingStatus === 'too_dark'
              ? 'Too Dark (Retake)'
              : 'Overexposed'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">Lum {qualityMetrics.avgLuminance}/255</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            {qualityMetrics.isSharp ? 'Sharp' : 'Soft'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">~{qualityMetrics.estimatedPayloadKb} KB</span>
        </div>
      )}

      {/* Field Test Samples Switcher */}
      <div className="pt-0.5">
        <p className="mb-1.5 text-[11px] font-medium text-[#475449]">
          Sample Photos (tap to switch crop inside viewfinder):
        </p>
        <div className={compact ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
          {FIELD_SAMPLES.map((sample) => {
            const selected = activeSampleId === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  closeCamera();
                  onImageSelected(sample.src, sample.id);
                }}
                className={`group flex min-h-[44px] items-center gap-2 rounded-xl border p-1.5 text-left transition-colors ${
                  selected
                    ? 'border-[#1B5E20] bg-[#EBF3EB]'
                    : 'border-[#E2E6DF] bg-white hover:bg-[#F5F7F3]'
                }`}
              >
                <img
                  src={sample.src}
                  alt={sample.label}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                />
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-[#182019]">
                  {sample.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
