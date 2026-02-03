import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (open) {
      setContent(item.content || item.description || '');
      setTitle(item.title || '');
      setLinkUrl(item.link_url || '');
      setLinkTitle(item.link_title || '');
      setLocation(item.location || '');
    }
  }, [open, item]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let error;
      
      if (item.type === 'post' || item.type === 'job') {
        ({ error } = await supabase
          .from('posts')
          .update({
            content,
            link_url: linkUrl || null,
            link_title: linkTitle || null,
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

  const isEvent = item.type === 'event';
  const isProject = item.type === 'project';
  const isJob = item.type === 'job';
  const showTitle = isEvent || isProject;
  const showLink = item.type === 'post' || isJob || isEvent;
  const showLocation = isEvent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
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
