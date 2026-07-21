import React, { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  urls: string[];
  positionX?: number;
  positionY?: number;
  className?: string;
  imageClassName?: string;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  urls,
  positionX = 50,
  positionY = 50,
  className,
  imageClassName,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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
    return (
      <div className={cn('rounded-lg overflow-hidden bg-muted flex items-center justify-center', className)}>
        <img
          src={urls[0]}
          alt="Post image"
          className={cn('w-full max-h-[32rem] object-contain', imageClassName)}
          style={{ objectPosition: `${positionX}% ${positionY}%` }}
        />
      </div>
    );
  }

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {urls.map((url, i) => (
            <div key={i} className="flex-none w-full">
              <img
                src={url}
                alt={`Image ${i + 1} of ${urls.length}`}
                className="w-full h-72 object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {canScrollPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollNext && (
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(i); }}
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
