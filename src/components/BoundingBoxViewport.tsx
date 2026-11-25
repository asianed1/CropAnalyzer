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
  const [isDraggingMove, setIsDraggingMove] = useState(false);
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
      setCameraError('Camera is not available here. Tap Upload Photo instead.');
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
      setCameraError('Camera was blocked or not found. Pick a photo from Gallery or tap a sample below.');
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

  const beginMoveDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingMove(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startBox: { ...box },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingMove || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - dragStartRef.current.clientX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.clientY) / rect.height;
    const start = dragStartRef.current.startBox;

    const nextX = Math.max(0.02, Math.min(0.98 - start.width, start.x + dx));
    const nextY = Math.max(0.02, Math.min(0.98 - start.height, start.y + dy));
    onBoxChange({ ...start, x: nextX, y: nextY });
  };

  const endDrag = () => {
    setIsDraggingMove(false);
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
            {cameraOpen ? 'Close' : 'Open Camera'}
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
          Reset Box
        </button>
      </div>

      {cameraError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {cameraError}
        </p>
      )}

      {/* Fixed QR-Style Center Framing Viewport */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#D4DBD0] bg-[#141A15] select-none touch-none"
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
            {/* Fixed Center Framing Reticle — move phone closer/farther to fill box */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-full w-full max-w-[74%] max-h-[76%] rounded-xl border-2 border-emerald-300/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <span className="absolute -top-6 left-0 right-0 text-center text-[11px] font-medium text-white drop-shadow">
                  Put sick leaf inside the green box — move closer or farther
                </span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={captureFromCamera}
                className="min-h-[44px] rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#182019] shadow-lg active:scale-95"
              >
                Take Photo
              </button>
            </div>
          </>
        ) : (
          <>
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Plant leaf preview"
              referrerPolicy="no-referrer"
              onLoad={(e) => onImageElementReady(e.currentTarget)}
              className="h-full w-full object-cover"
            />

            {/* Simple Center Frame (1-finger slide allowed on saved/uploaded photos) */}
            <div
              onPointerDown={beginMoveDrag}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              className="absolute cursor-move rounded-xl border-2 border-emerald-300 shadow-[0_0_0_9999px_rgba(12,18,13,0.45)]"
            >
              <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
                Move box over sick spot
              </span>
            </div>
          </>
        )}
      </div>

      {/* Simple Plain-English Lighting Hint */}
      {qualityMetrics && !cameraOpen && (
        <p className="text-[11px] font-medium text-[#475449]">
          {qualityMetrics.lightingStatus === 'well_lit'
            ? 'Lighting looks good — move camera closer so the sick part fills the green box.'
            : qualityMetrics.lightingStatus === 'too_dark'
            ? 'Photo is too dark — move into brighter daylight and try again.'
            : 'Too much glare — shade the leaf slightly with your hand or body.'}
        </p>
      )}

      {/* Test Mode Demo Photos Switcher */}
      <div className="pt-0.5">
        <p className="mb-1.5 text-[11px] font-medium text-[#475449]">
          Test Mode — Demo Sample Photos (when no plant is nearby):
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
