import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Move, X, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { FeedItemData } from './FeedItem';
import { ImageUploader } from './ImageUploader';
import { ImagePositioner } from '@/components/profile/ImagePositioner';

type ImagePosition = { x: number; y: number; zoom: number };

const DEFAULT_IMAGE_POSITION: ImagePosition = { x: 50, y: 50, zoom: 1 };
const MAX_IMAGES = 4;

const normalizeImagePositions = (
  positions: FeedItemData['image_positions'] | unknown,
  count: number,
  fallback: ImagePosition,
): ImagePosition[] => {
  const source = Array.isArray(positions) ? positions : [];
  return Array.from({ length: count }, (_, index) => {
    const position = source[index] as Partial<ImagePosition> | undefined;
    return {
      x: typeof position?.x === 'number' ? position.x : fallback.x,
      y: typeof position?.y === 'number' ? position.y : fallback.y,
      zoom: typeof position?.zoom === 'number' ? position.zoom : fallback.zoom,
    };
  });
};

const serializeImagePositions = (positions: ImagePosition[], count: number): Json | null => {
  if (count === 0) return null;

  return Array.from({ length: count }, (_, index) => {
    const position = positions[index] ?? DEFAULT_IMAGE_POSITION;
    return {
      x: Number.isFinite(position.x) ? position.x : DEFAULT_IMAGE_POSITION.x,
      y: Number.isFinite(position.y) ? position.y : DEFAULT_IMAGE_POSITION.y,
      zoom: Number.isFinite(position.zoom) ? position.zoom : DEFAULT_IMAGE_POSITION.zoom,
    };
  });
};

const PositionedImagePreview: React.FC<{
  url: string;
  position: ImagePosition;
  alt: string;
}> = ({ url, position, alt }) => {
  const zoom = position.zoom ?? 1;

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      <div
        style={{
          position: 'absolute',
          left: `${position.x * (1 - zoom)}%`,
          top: `${position.y * (1 - zoom)}%`,
          right: `${(100 - position.x) * (1 - zoom)}%`,
          bottom: `${(100 - position.y) * (1 - zoom)}%`,
        }}
      >
        <img
          src={url}
          alt={alt}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${position.x}% ${position.y}%`,
          }}
        />
      </div>
    </div>
  );
};

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FeedItemData;
}

export const EditPostDialog: React.FC<EditPostDialogProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { canManageEvents, canManageJobs, canManageProjects } = useFeatureAccess();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePositions, setImagePositions] = useState<ImagePosition[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageUploader, setShowImageUploader] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(item.content || item.description || '');
      setTitle(item.title || '');
      setLinkUrl(item.link_url || '');
      setLinkTitle(item.link_title || '');
      setLocation(item.location || '');
      const urls = item.image_urls?.length ? item.image_urls : item.image_url ? [item.image_url] : [];
      const fallback = {
        x: item.image_position_x ?? DEFAULT_IMAGE_POSITION.x,
        y: item.image_position_y ?? DEFAULT_IMAGE_POSITION.y,
        zoom: item.image_zoom ?? DEFAULT_IMAGE_POSITION.zoom,
      };
      setImageUrls(urls);
      setImagePositions(normalizeImagePositions(item.image_positions, urls.length, fallback));
      setSelectedImageIndex(0);
      setShowImageUploader(false);
    }
  }, [open, item]);

  // Fetch current image metadata for posts/events so edit mode reflects the saved carousel.
  useEffect(() => {
    const fetchImageMetadata = async () => {
      if (open && (item.type === 'post' || item.type === 'job' || item.type === 'event')) {
        const table = item.type === 'event' ? 'events' : 'posts';
        const { data } = await supabase
          .from(table)
          .select('image_url, image_urls, image_position_x, image_position_y, image_zoom, image_positions')
          .eq('id', item.id)
          .single();
        
        if (data) {
          const urls = data.image_urls?.length ? data.image_urls : data.image_url ? [data.image_url] : [];
          const fallback = {
            x: data.image_position_x ?? DEFAULT_IMAGE_POSITION.x,
            y: data.image_position_y ?? DEFAULT_IMAGE_POSITION.y,
            zoom: data.image_zoom ?? DEFAULT_IMAGE_POSITION.zoom,
          };
          setImageUrls(urls);
          setImagePositions(normalizeImagePositions(data.image_positions, urls.length, fallback));
          setSelectedImageIndex(0);
        }
      }
    };
    fetchImageMetadata();
  }, [open, item.id, item.type]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let error;
      const primaryPosition = imagePositions[0] ?? DEFAULT_IMAGE_POSITION;
      const serializedPositions = serializeImagePositions(imagePositions, imageUrls.length);
      if (!isAdmin) {
        if (item.type === 'event' && !canManageEvents) throw new Error('This beta group cannot edit events.');
        if (item.type === 'job' && !canManageJobs) throw new Error('This beta group cannot edit jobs.');
        if (item.type === 'project' && !canManageProjects) throw new Error('This beta group cannot edit projects.');
      }
      
      if (item.type === 'post' || item.type === 'job') {
        ({ error } = await supabase
          .from('posts')
          .update({
            content,
            link_url: linkUrl || null,
            link_title: linkTitle || null,
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            image_position_x: primaryPosition.x,
            image_position_y: primaryPosition.y,
            image_zoom: primaryPosition.zoom,
            image_positions: serializedPositions,
          })
          .eq('id', item.id));
      } else if (item.type === 'event') {
        ({ error } = await supabase
          .from('events')
          .update({
            title,
            description: content,
            link_url: linkUrl || null,
            link_title: linkTitle || null,
            location: location || null,
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            image_position_x: primaryPosition.x,
            image_position_y: primaryPosition.y,
            image_zoom: primaryPosition.zoom,
            image_positions: serializedPositions,
          })
          .eq('id', item.id));
      } else if (item.type === 'project') {
        ({ error } = await supabase
          .from('projects')
          .update({
            title,
            description: content,
          })
          .eq('id', item.id));
      }
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed-events'] });
      queryClient.invalidateQueries({ queryKey: ['feed-projects'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      toast.success('Post updated successfully');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('Failed to update post:', error);
      toast.error(error.message || 'Failed to update. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const handleImageUploaded = (url: string) => {
    setImageUrls((current) => {
      if (current.length >= MAX_IMAGES) return current;
      const next = [...current, url].slice(0, MAX_IMAGES);
      setSelectedImageIndex(next.length - 1);
      setShowImageUploader(next.length < MAX_IMAGES);
      return next;
    });
    setImagePositions((current) => {
      if (current.length >= MAX_IMAGES) return current;
      return [...current, DEFAULT_IMAGE_POSITION].slice(0, MAX_IMAGES);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls((current) => {
      const next = current.filter((_, i) => i !== index);
      setSelectedImageIndex((selected) => Math.min(selected, Math.max(next.length - 1, 0)));
      setShowImageUploader(false);
      return next;
    });
    setImagePositions((current) => current.filter((_, i) => i !== index));
  };

  const handlePositionSave = (index: number, x: number, y: number, zoom: number) => {
    setImagePositions((current) => {
      const next = [...current];
      next[index] = { x, y, zoom };
      return next;
    });
  };

  const isEvent = item.type === 'event';
  const isProject = item.type === 'project';
  const isJob = item.type === 'job';
  const showTitle = isEvent || isProject;
  const showLink = item.type === 'post' || isJob || isEvent;
  const showLocation = isEvent;
  const showImage = item.type === 'post' || isJob || isEvent;
  const atImageLimit = imageUrls.length >= MAX_IMAGES;
  const selectedImageUrl = imageUrls[selectedImageIndex];
  const selectedImagePosition = imagePositions[selectedImageIndex] ?? DEFAULT_IMAGE_POSITION;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Edit {item.type === 'job' ? 'Opportunity' : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {showTitle && (
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title..."
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="content">
                {isEvent || isProject ? 'Description' : 'Content'}
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
              />
            </div>

            {/* Image Section */}
            {showImage && (
              <div className="space-y-2">
                <Label>Image</Label>
                
                {imageUrls.length > 0 ? (
                  <div className="space-y-3">
                    {selectedImageUrl && (
                      <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                        <div className="relative aspect-video">
                          <PositionedImagePreview
                            url={selectedImageUrl}
                            position={selectedImagePosition}
                            alt={`Post image ${selectedImageIndex + 1}`}
                          />
                        </div>

                        <div className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                          {selectedImageIndex + 1} / {imageUrls.length}
                        </div>

                        {imageUrls.length > 1 && selectedImageIndex > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm"
                            onClick={() => setSelectedImageIndex((current) => Math.max(current - 1, 0))}
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        )}

                        {imageUrls.length > 1 && selectedImageIndex < imageUrls.length - 1 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm"
                            onClick={() => setSelectedImageIndex((current) => Math.min(current + 1, imageUrls.length - 1))}
                            aria-label="Next image"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}

                        <div className="absolute right-2 top-2 flex gap-2">
                          <ImagePositioner
                            imageUrl={selectedImageUrl}
                            initialPositionX={selectedImagePosition.x}
                            initialPositionY={selectedImagePosition.y}
                            initialZoom={selectedImagePosition.zoom}
                            aspectRatio={16 / 9}
                            onSave={(x, y, zoom) => handlePositionSave(selectedImageIndex, x, y, zoom)}
                            trigger={
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                              >
                                <Move className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveImage(selectedImageIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {imageUrls.length > 1 && (
                          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                            {imageUrls.map((_, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setSelectedImageIndex(index)}
                                aria-label={`Show image ${index + 1}`}
                                className={`h-1.5 rounded-full transition-all duration-200 ${
                                  index === selectedImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageUploader(true)}
                      disabled={atImageLimit}
                      className="w-full"
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      {atImageLimit ? 'Max images' : `Add image (${MAX_IMAGES - imageUrls.length} remaining)`}
                    </Button>
                  </div>
                ) : showImageUploader || imageUrls.length === 0 ? (
                  user && (
                    <ImageUploader
                      userId={user.id}
                      onImageUploaded={handleImageUploaded}
                      currentCount={imageUrls.length}
                      className="w-full"
                    />
                  )
                ) : null}

                {imageUrls.length > 0 && showImageUploader && user && !atImageLimit && (
                  <div className="mt-2">
                    <ImageUploader
                      userId={user.id}
                      onImageUploaded={handleImageUploaded}
                      currentCount={imageUrls.length}
                      className="w-full"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowImageUploader(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {imageUrls.length === 0 && !showImageUploader && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImageUploader(true)}
                    className="w-full"
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Add Image
                  </Button>
                )}
              </div>
            )}

            {showLocation && (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Event location..."
                />
              </div>
            )}

            {showLink && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="linkUrl">Link URL</Label>
                  <Input
                    id="linkUrl"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkTitle">Link Title</Label>
                  <Input
                    id="linkTitle"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Link description..."
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
