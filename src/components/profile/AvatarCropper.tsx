import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface AvatarCropperProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (blob: Blob) => Promise<void>;
  title?: string;
  saveLabel?: string;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to a reasonable avatar size
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  const rotateRads = (rotate * Math.PI) / 180;
  const centerX = outputSize / 2;
  const centerY = outputSize / 2;

  ctx.save();

  // Move to center and apply rotation
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  // Draw the cropped image
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputSize,
    outputSize
  );

  ctx.restore();

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
      0.95
    );
  });
}

export const AvatarCropper: React.FC<AvatarCropperProps> = ({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  title = 'Crop Avatar',
  saveLabel = 'Save Avatar',
}) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const nextCrop = centerAspectCrop(width, height, 1);
    setCrop(nextCrop);
    setCompletedCrop(convertToPixelCrop(nextCrop, width, height));
  }, []);

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;

    setSaving(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop, scale, rotate);
      await onCropComplete(blob);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, 1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div className="relative flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-[300px]">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              className="max-h-[400px]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                crossOrigin="anonymous"
                onLoad={onImageLoad}
                style={{
                  transform: `scale(${scale}) rotate(${rotate}deg)`,
                  maxHeight: '400px',
                  width: 'auto',
                }}
                className="transition-transform"
              />
            </ReactCrop>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[scale]}
                min={0.5}
                max={3}
                step={0.1}
                onValueChange={([value]) => setScale(value)}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[rotate]}
                min={-180}
                max={180}
                step={1}
                onValueChange={([value]) => setRotate(value)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-12 text-right">{rotate}°</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !completedCrop}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
