import React from 'react';
import { Tv, Film, Star, Calendar, ExternalLink, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface StreamingContent {
  id: string;
  title: string;
  content_type: 'movie' | 'tv';
  platform: string;
  description?: string;
  poster_url?: string;
  genre?: string;
  release_year?: number;
  rating: number;
  watch_url?: string;
}

interface StreamingDetailSheetProps {
  content: StreamingContent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StreamingDetailSheet: React.FC<StreamingDetailSheetProps> = ({
  content,
  isOpen,
  onClose,
}) => {
  if (!content) return null;

  const watchHref =
    content.watch_url ||
    `https://www.google.com/search?q=${encodeURIComponent(`${content.title} watch on ${content.platform}`)}`;

  const Icon = content.content_type === 'tv' ? Tv : Film;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="relative -mx-6 -mt-6">
            {content.poster_url ? (
              <img
                src={content.poster_url}
                alt={content.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <Icon className="w-20 h-20 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="backdrop-blur-sm"
                onClick={() => {
                  navigator.share?.({
                    title: content.title,
                    text: `Check out ${content.title} on ${content.platform}!`,
                    url: watchHref,
                  });
                }}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <SheetTitle className="text-2xl font-display pr-8">{content.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="w-4 h-4" />
              <span>{content.platform}</span>
            </div>

            {content.release_year && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{content.release_year}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {Number(content.rating).toFixed(1)}
              </Badge>
              <Badge variant="outline">
                {content.content_type === 'tv' ? 'TV Series' : 'Movie'}
              </Badge>
              {content.genre && <Badge variant="outline">{content.genre}</Badge>}
            </div>
          </div>

          {content.description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {content.description}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button className="flex-1" asChild>
              <a href={watchHref} target="_blank" rel="noopener noreferrer">
                Watch on {content.platform}
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StreamingDetailSheet;