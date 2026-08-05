import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface ProjectImageCropperProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (blob: Blob) => Promise<void>;
  title: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
}

const CONTAINER_HEIGHT = 400;

// Draw the full-res image to a canvas at display size and return a JPEG data URL.
// The resulting data URL is small enough that Chrome can decode it synchronously,
// so react-easy-crop sees naturalWidth > 0 at componentDidMount.
async function buildDisplaySrc(
  imageSrc: string,
  containerW: number,
  containerH: number,
): Promise<{ dataUrl: string; scaleX: number; scaleY: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = imageSrc;
    if (img.complete && img.naturalWidth > 0) resolve();
  });

  const scale = Math.min(containerW / img.naturalWidth, containerH / img.naturalHeight);
  const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
  const drawH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = drawW;
  canvas.height = drawH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, drawW, drawH);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    scaleX: img.naturalWidth / drawW,
    scaleY: img.naturalHeight / drawH,
  };
}

async function getCroppedBlob(
  imageSrc: string,
  croppedAreaPixels: Area,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = imageSrc;
    if (image.complete && image.naturalWidth > 0) resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Canvas is empty'));
        else resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

export const ProjectImageCropper: React.FC<ProjectImageCropperProps> = ({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  title,
  aspect,
  outputWidth,
  outputHeight,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperKey, setCropperKey] = useState(0);
  // Pre-rendered display image and scale back to original coords
  const [displaySrc, setDisplaySrc] = useState('');
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowCropper(false);
    setCropperKey(0);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setDisplaySrc('');
    setScaleX(1);
    setScaleY(1);
  }, [open, imageSrc]);

  // Wait for dialog animation to finish, then decode the image via canvas at
  // display size. Passing a canvas-derived JPEG data URL to the Cropper means
  // the browser has already decoded it — naturalWidth is correct at
  // componentDidMount without any further timing tricks.
  useEffect(() => {
    if (!open || !imageSrc) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const containerW = outerContainerRef.current?.offsetWidth ?? 720;
        const result = await buildDisplaySrc(imageSrc, containerW, CONTAINER_HEIGHT);
        if (cancelled) return;
        setScaleX(result.scaleX);
        setScaleY(result.scaleY);
        setDisplaySrc(result.dataUrl);
      } catch (err) {
        console.error('ProjectImageCropper: failed to build display src', err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, imageSrc]);

  // Mount the Cropper one rAF after the display src is ready, so the data URL
  // string is committed to the DOM before we check complete/naturalWidth.
  useEffect(() => {
    if (!displaySrc) return;
    const id = requestAnimationFrame(() => {
      setCropperKey((k) => k + 1);
      setShowCropper(true);
    });
    return () => cancelAnimationFrame(id);
  }, [displaySrc]);

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      // Scale crop coords from display space back to original image space
      const originalArea: Area = {
        x: Math.round(croppedAreaPixels.x * scaleX),
        y: Math.round(croppedAreaPixels.y * scaleY),
        width: Math.round(croppedAreaPixels.width * scaleX),
        height: Math.round(croppedAreaPixels.height * scaleY),
      };
      const blob = await getCroppedBlob(imageSrc, originalArea, outputWidth, outputHeight);
      await onCropComplete(blob);
      onClose();
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={outerContainerRef}
            style={{
              position: 'relative',
              height: CONTAINER_HEIGHT,
              borderRadius: '0.5rem',
              overflow: 'hidden',
              backgroundColor: 'hsl(var(--muted))',
            }}
          >
            {!showCropper && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {showCropper && (
              <Cropper
                key={cropperKey}
                image={displaySrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                style={{
                  containerStyle: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  },
                }}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([value]) => setZoom(value)}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Use image'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
