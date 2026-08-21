import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { Area, Point } from 'react-easy-crop';
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

async function getCroppedImageBlob(
  imageSrc: string,
  croppedAreaPixels: Area,
  outputWidth: number,
  outputHeight: number
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  canvas.width = outputWidth;
  canvas.height = outputHeight;
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
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, pixels: Area) => {
      setCroppedAreaPixels(pixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    setSaving(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, outputWidth, outputHeight);
      await onCropComplete(blob);
      onClose();
    } catch (error) {
      console.error('Project image crop failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden bg-muted" style={{ height: '320px' }}>
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropCompleteCallback}
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
