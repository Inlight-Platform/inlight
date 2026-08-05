import React, { useState, useRef, useEffect } from 'react';
import { Move, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ImagePositionerProps {
  imageUrl: string;
  initialPositionX?: number;
  initialPositionY?: number;
  initialZoom?: number;
  aspectRatio?: number;
  onSave: (positionX: number, positionY: number, zoom?: number) => void;
  onCancel?: () => void;
  trigger?: React.ReactNode;
}

export const ImagePositioner: React.FC<ImagePositionerProps> = ({
  imageUrl,
  initialPositionX = 50,
  initialPositionY = 50,
  initialZoom = 100,
  aspectRatio = 16 / 9,
  onSave,
  onCancel,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [positionX, setPositionX] = useState(initialPositionX);
  const [positionY, setPositionY] = useState(initialPositionY);
  const [zoom, setZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref keeps drag handler free of stale closures without re-attaching the listener
  const stateRef = useRef({ positionX, positionY, zoom });

  useEffect(() => {
    stateRef.current = { positionX, positionY, zoom };
  }, [positionX, positionY, zoom]);

  useEffect(() => {
    if (open) {
      setPositionX(initialPositionX);
      setPositionY(initialPositionY);
      setZoom(initialZoom);
    }
  }, [open, initialPositionX, initialPositionY, initialZoom]);

  // Attach via native DOM so Radix event interception is bypassed entirely.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;

    const handleDown = (e: PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = stateRef.current.positionX;
      const startPosY = stateRef.current.positionY;
      const z = stateRef.current.zoom / 100;
      setIsDragging(true);

      const onMove = (ev: PointerEvent) => {
        if (!containerRef.current || z <= 1) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dxNorm = (ev.clientX - startX) / rect.width;
        const dyNorm = (ev.clientY - startY) / rect.height;
        // 1:1 pixel tracking matched to translate(tx%, ty%) scale(z) formula
        setPositionX(Math.max(0, Math.min(100, startPosX - (dxNorm * 100) / (z - 1))));
        setPositionY(Math.max(0, Math.min(100, startPosY - (dyNorm * 100) / (z - 1))));
      };

      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    };

    el.addEventListener('pointerdown', handleDown);
    return () => el.removeEventListener('pointerdown', handleDown);
  }, [open]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(100, Math.min(300, prev - e.deltaY * 0.5)));
  };

  const handleSave = () => {
    onSave(Math.round(positionX), Math.round(positionY), Math.round(zoom));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

  const z = zoom / 100;
  const tx = (50 - positionX) * (z - 1);
  const ty = (50 - positionY) * (z - 1);

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-8 w-8"
          title="Adjust image position"
        >
          <Move className="w-4 h-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="w-5 h-5" />
              Adjust Image Position
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Zoom in, then drag to reposition.
            </p>

            <div
              ref={containerRef}
              className={`w-full overflow-hidden rounded-lg border border-border bg-muted select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ aspectRatio: String(aspectRatio), touchAction: 'none' }}
              onWheel={handleWheel}
            >
              <img
                src={imageUrl}
                alt="Position preview"
                className="w-full h-full select-none pointer-events-none"
                style={{
                  display: 'block',
                  objectFit: 'cover',
                  transform: `translate(${tx}%, ${ty}%) scale(${z})`,
                  transformOrigin: 'center center',
                }}
                draggable={false}
              />
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[zoom]}
                onValueChange={([val]) => setZoom(val)}
                min={100}
                max={300}
                step={5}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-10 text-right">{zoom}%</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Check className="w-4 h-4 mr-2" />
              Save Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
