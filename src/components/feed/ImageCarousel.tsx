import React, { useState, useCallback, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  urls: string[];
  positionX?: number;
  positionY?: number;
  positionZoom?: number;
  className?: string;
  imageClassName?: string;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  urls,
  positionX = 50,
  positionY = 50,
  positionZoom = 1,
  className,
  imageClassName,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  if (urls.length === 1) {
    const zoom = positionZoom ?? 1;
    return (
      <div className={cn('rounded-lg overflow-hidden bg-muted relative', className)}>
        {zoom > 1 ? (
          <div style={{ position: 'absolute', inset: 0 }}>
            <div
              style={{
                position: 'absolute',
                left: `${positionX * (1 - zoom)}%`,
                top: `${positionY * (1 - zoom)}%`,
                right: `${(100 - positionX) * (1 - zoom)}%`,
                bottom: `${(100 - positionY) * (1 - zoom)}%`,
              }}
            >
              <img
                src={urls[0]}
                alt="Post image"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                  objectPosition: `${positionX}% ${positionY}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <img
            src={urls[0]}
            alt="Post image"
            className={cn('w-full max-h-[32rem] object-contain', imageClassName)}
            style={{ objectPosition: `${positionX}% ${positionY}%` }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('relative rounded-lg overflow-hidden', className)}
      onPointerDown={(e) => {
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
        didDragRef.current = false;
      }}
      onPointerMove={(e) => {
        const start = pointerStartRef.current;
        if (!start) return;
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved > 6) {
          didDragRef.current = true;
        }
      }}
      onClickCapture={(e) => {
        if (didDragRef.current) {
          e.stopPropagation();
          didDragRef.current = false;
        }
      }}
    >
      <div ref={emblaRef} className={cn('overflow-hidden', className && 'h-full')}>
        <div className={cn('flex', className && 'h-full')}>
          {urls.map((url, i) => (
            <div key={i} className={cn('flex-none w-full', className && 'h-full')}>
              <img
                src={url}
                alt={`Image ${i + 1} of ${urls.length}`}
                className={cn('w-full h-72 object-cover', imageClassName)}
              />
            </div>
          ))}
        </div>
      </div>

      {canScrollPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
          className="absolute left-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollNext && (
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 flex gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(i); }}
            aria-label={`Show image ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              i === selectedIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'
            )}
          />
        ))}
      </div>
    </div>
  );
};
