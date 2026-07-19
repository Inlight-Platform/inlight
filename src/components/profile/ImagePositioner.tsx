import React, { useState, useRef, useEffect } from 'react';
import { Move, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  aspectRatio?: number;
  onSave: (positionX: number, positionY: number) => void;
  onCancel?: () => void;
  trigger?: React.ReactNode;
}

export const ImagePositioner: React.FC<ImagePositionerProps> = ({
  imageUrl,
  initialPositionX = 50,
  initialPositionY = 50,
  aspectRatio = 16 / 9,
  onSave,
  onCancel,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [positionX, setPositionX] = useState(initialPositionX);
  const [positionY, setPositionY] = useState(initialPositionY);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  useEffect(() => {
    if (open) {
      setPositionX(initialPositionX);
      setPositionY(initialPositionY);
      setZoom(1);
    }
  }, [open, initialPositionX, initialPositionY]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: positionX,
      startPosY: positionY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * (100 / zoom);
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * (100 / zoom);
    setPositionX(Math.max(0, Math.min(100, dragRef.current.startPosX - dx)));
    setPositionY(Math.max(0, Math.min(100, dragRef.current.startPosY - dy)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    onSave(Math.round(positionX), Math.round(positionY));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

  const objectPosition = `${positionX}% ${positionY}%`;

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

          <div className="py-2 space-y-3">
            {/* Drag area */}
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-lg border border-border cursor-grab active:cursor-grabbing bg-muted select-none"
              style={{ paddingBottom: `${100 / aspectRatio}%` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={imageUrl}
                alt="Positioning view"
                className="absolute w-full h-full pointer-events-none"
                style={{
                  objectFit: 'cover',
                  objectPosition,
                  transform: `scale(${zoom})`,
                  transformOrigin: objectPosition,
                }}
                draggable={false}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Saved result preview — no zoom */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Saved result</p>
              <div
                className="relative w-full overflow-hidden rounded-lg border border-border bg-muted"
                style={{ paddingBottom: `${100 / aspectRatio}%` }}
              >
                <img
                  src={imageUrl}
                  alt="Saved result preview"
                  className="absolute w-full h-full pointer-events-none"
                  style={{ objectFit: 'cover', objectPosition }}
                  draggable={false}
                />
              </div>
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
