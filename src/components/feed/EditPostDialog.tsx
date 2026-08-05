import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Move, X, ImagePlus } from 'lucide-react';
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
import { FeedItemData } from './FeedItem';
import { ImageUploader } from './ImageUploader';
import { ImagePositioner } from '@/components/profile/ImagePositioner';

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [positionX, setPositionX] = useState<number>(50);
  const [positionY, setPositionY] = useState<number>(50);
  const [showImageUploader, setShowImageUploader] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(item.content || item.description || '');
      setTitle(item.title || '');
      setLinkUrl(item.link_url || '');
      setLinkTitle(item.link_title || '');
      setLocation(item.location || '');
      setImageUrl(item.image_url || null);
      // We'll need to fetch position from the database for posts
      setPositionX(50);
      setPositionY(50);
      setShowImageUploader(false);
    }
  }, [open, item]);

  // Fetch current image position for posts
  useEffect(() => {
    const fetchPosition = async () => {
      if (open && (item.type === 'post' || item.type === 'job' || item.type === 'event') && item.image_url) {
        const table = item.type === 'event' ? 'events' : 'posts';
        const { data } = await supabase
          .from(table)
          .select('image_position_x, image_position_y')
          .eq('id', item.id)
          .single();
        
        if (data) {
          setPositionX(data.image_position_x ?? 50);
          setPositionY(data.image_position_y ?? 50);
        }
      }
    };
    fetchPosition();
  }, [open, item.id, item.type, item.image_url]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let error;
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
            image_url: imageUrl,
            image_position_x: positionX,
            image_position_y: positionY,
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
            image_url: imageUrl,
            image_position_x: positionX,
            image_position_y: positionY,
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
    onError: () => {
      toast.error('Failed to update. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const handleImageUploaded = (url: string) => {
    setImageUrl(url);
    setPositionX(50);
    setPositionY(50);
    setShowImageUploader(false);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setPositionX(50);
    setPositionY(50);
  };

  const handlePositionSave = (x: number, y: number) => {
    setPositionX(x);
    setPositionY(y);
  };

  const isEvent = item.type === 'event';
  const isProject = item.type === 'project';
  const isJob = item.type === 'job';
  const showTitle = isEvent || isProject;
  const showLink = item.type === 'post' || isJob || isEvent;
  const showLocation = isEvent;
  const showImage = item.type === 'post' || isJob || isEvent;

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
                
                {imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img
                      src={imageUrl}
                      alt="Post image"
                      className="w-full max-h-48 object-cover"
                      style={{
                        objectPosition: `${positionX}% ${positionY}%`,
                      }}
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <ImagePositioner
                        imageUrl={imageUrl}
                        initialPositionX={positionX}
                        initialPositionY={positionY}
                        aspectRatio={16 / 9}
                        onSave={handlePositionSave}
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
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                        onClick={() => setShowImageUploader(true)}
                      >
                        <ImagePlus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : showImageUploader || !imageUrl ? (
                  user && (
                    <ImageUploader
                      userId={user.id}
                      onImageUploaded={handleImageUploaded}
                      className="w-full"
                    />
                  )
                ) : null}

                {imageUrl && showImageUploader && user && (
                  <div className="mt-2">
                    <ImageUploader
                      userId={user.id}
                      onImageUploaded={handleImageUploaded}
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

                {!imageUrl && !showImageUploader && (
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
