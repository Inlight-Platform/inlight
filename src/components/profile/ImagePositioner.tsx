import React, { useState, useRef, useEffect } from 'react';
import { Move, Check, X } from 'lucide-react';
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
  const dragRef = useRef<{
    startX: number; startY: number; startPosX: number; startPosY: number;
  } | null>(null);

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

  // Zoom by expanding the image beyond the container and offsetting it
  // so the current positionX/Y stays anchored inside the visible area
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${positionX * (1 - zoom)}%`,
    top: `${positionY * (1 - zoom)}%`,
    objectFit: 'cover',
    objectPosition,
    pointerEvents: 'none',
    userSelect: 'none',
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

          <div className="py-2 space-y-3">
            {/* Drag + zoom area */}
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-lg border border-border cursor-grab active:cursor-grabbing bg-muted select-none"
              style={{ aspectRatio: String(aspectRatio) }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={imageUrl}
                alt="Positioning view"
                style={imgStyle}
                draggable={false}
              />
            </div>

            {/* Zoom controls */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Zoom: {Math.round(zoom * 100)}%</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-3"
                  disabled={zoom <= 1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setZoom((z) => Math.max(1, parseFloat((z - 0.25).toFixed(2))))}
                >
                  − Zoom out
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-3"
                  disabled={zoom >= 3}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setZoom((z) => Math.min(3, parseFloat((z + 0.25).toFixed(2))))}
                >
                  + Zoom in
                </Button>
              </div>
            </div>

            {/* Saved result — no zoom */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Saved result (what the post will show)</p>
              <div
                className="relative w-full overflow-hidden rounded-lg border border-border bg-muted"
                style={{ aspectRatio: String(aspectRatio) }}
              >
                <img
                  src={imageUrl}
                  alt="Saved result preview"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: 'cover', objectPosition, pointerEvents: 'none' }}
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
