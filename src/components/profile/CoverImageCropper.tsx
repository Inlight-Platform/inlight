import React, { useCallback, useRef, useState } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Lock, Unlock, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface CoverImageCropperProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (blob: Blob) => Promise<void>;
}

const ASPECT_OPTIONS = [
  { label: 'Profile', value: 16 / 4.5 },
  { label: 'Wide', value: 4 },
  { label: '16:9', value: 16 / 9 },
];

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 92,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedCover(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;
  const outputWidth = 1920;
  const outputHeight = Math.max(1, Math.round(outputWidth * (cropHeight / cropWidth)));

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

export const CoverImageCropper: React.FC<CoverImageCropperProps> = ({
  open,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [aspect, setAspect] = useState(ASPECT_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const resetCrop = useCallback(() => {
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    const nextCrop = aspectLocked ? centerAspectCrop(width, height, aspect) : undefined;
    setCrop(nextCrop);
    setCompletedCrop(nextCrop ? convertToPixelCrop(nextCrop, width, height) : undefined);
  }, [aspect, aspectLocked]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const nextCrop = centerAspectCrop(width, height, aspect);
    setCrop(nextCrop);
    setCompletedCrop(convertToPixelCrop(nextCrop, width, height));
  }, [aspect]);

  const handleAspectChange = (nextAspect: number) => {
    setAspect(nextAspect);
    setAspectLocked(true);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const nextCrop = centerAspectCrop(width, height, nextAspect);
      setCrop(nextCrop);
      setCompletedCrop(convertToPixelCrop(nextCrop, width, height));
    }
  };

  const handleAspectLockToggle = () => {
    const nextLocked = !aspectLocked;
    setAspectLocked(nextLocked);
    if (imgRef.current && nextLocked) {
      const { width, height } = imgRef.current;
      const nextCrop = centerAspectCrop(width, height, aspect);
      setCrop(nextCrop);
      setCompletedCrop(convertToPixelCrop(nextCrop, width, height));
    }
  };

  const handleReset = () => {
    setZoom(1);
    resetCrop();
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;

    setSaving(true);
    try {
      const blob = await getCroppedCover(imgRef.current, completedCrop);
      await onCropComplete(blob);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Crop Cover Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted p-3">
            <div className="max-h-[520px] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(nextCrop) => setCompletedCrop(nextCrop)}
                aspect={aspectLocked ? aspect : undefined}
                className="max-w-none"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Cover crop preview"
                  onLoad={onImageLoad}
                  style={{
                    width: `${zoom * 100}%`,
                    maxWidth: 'none',
                  }}
                />
              </ReactCrop>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={0.75}
                max={2.5}
                step={0.05}
                onValueChange={([value]) => setZoom(value)}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
              <span className="w-12 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAspectLockToggle}>
                {aspectLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                {aspectLocked ? 'Locked' : 'Free'}
              </Button>
              {ASPECT_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={aspectLocked && aspect === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleAspectChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !completedCrop}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Cover'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
