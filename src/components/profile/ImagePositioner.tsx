import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  const [dragStart, setDragStart] = useState<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPositionX(initialPositionX);
      setPositionY(initialPositionY);
      setZoom(initialZoom);
    }
  }, [open, initialPositionX, initialPositionY, initialZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, posX: positionX, posY: positionY });
  }, [positionX, positionY]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current || !dragStart) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Scale sensitivity by zoom level - more zoom = finer control
    const sensitivity = 100 / (zoom / 100);
    const dx = ((e.clientX - dragStart.x) / rect.width) * sensitivity;
    const dy = ((e.clientY - dragStart.y) / rect.height) * sensitivity;

    // Invert: dragging right should move the image left (decrease position)
    setPositionX(Math.max(0, Math.min(100, dragStart.posX - dx)));
    setPositionY(Math.max(0, Math.min(100, dragStart.posY - dy)));
  }, [isDragging, dragStart, zoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY, posX: positionX, posY: positionY });
  }, [positionX, positionY]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current || !dragStart) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const sensitivity = 100 / (zoom / 100);
    const dx = ((touch.clientX - dragStart.x) / rect.width) * sensitivity;
    const dy = ((touch.clientY - dragStart.y) / rect.height) * sensitivity;

    setPositionX(Math.max(0, Math.min(100, dragStart.posX - dx)));
    setPositionY(Math.max(0, Math.min(100, dragStart.posY - dy)));
  }, [isDragging, dragStart, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(100, Math.min(300, prev - e.deltaY * 0.5)));
  }, []);

  const handleSave = () => {
    onSave(Math.round(positionX), Math.round(positionY), Math.round(zoom));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

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
              Drag to reposition. Scroll or use the slider to zoom.
            </p>
            
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-lg border border-border cursor-grab active:cursor-grabbing bg-muted"
              style={{ paddingBottom: `${100 / aspectRatio}%` }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onWheel={handleWheel}
            >
              <img
                src={imageUrl}
                alt="Position preview"
                className="absolute w-full h-full select-none pointer-events-none"
                style={{
                  objectFit: 'cover',
                  objectPosition: `${positionX}% ${positionY}%`,
                }}
                draggable={false}
              />
            </div>

            {/* Zoom controls */}
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
