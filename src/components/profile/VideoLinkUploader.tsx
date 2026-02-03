import React, { useState } from 'react';
import { Link, Plus, Video, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface VideoLinkUploaderProps {
  userId: string;
  onComplete?: () => void;
}

export const VideoLinkUploader: React.FC<VideoLinkUploaderProps> = ({ userId, onComplete }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleAddVideoLink = async () => {
    if (!videoUrl.trim()) {
      toast.error('Please enter a video URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(videoUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_media')
        .insert({
          user_id: userId,
          file_path: videoUrl.trim(),
          file_name: videoName.trim() || 'Video Link',
          file_type: 'video',
          mime_type: 'video/external',
          file_size: 0,
          visibility: 'public',
        });

      if (error) throw error;

      toast.success('Video link added!');
      setDialogOpen(false);
      setVideoUrl('');
      setVideoName('');
      
      // Invalidate to refresh the media list
      await queryClient.invalidateQueries({ queryKey: ['user-media', userId] });
      onComplete?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add video link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="gap-2"
      >
        <Link className="w-4 h-4" />
        Add Video Link
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Add Video Link
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-name">Title (optional)</Label>
              <Input
                id="video-name"
                placeholder="My Demo Reel"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL *</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Supports YouTube, Vimeo, or any direct video URL
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddVideoLink} disabled={saving || !videoUrl.trim()}>
              {saving ? 'Adding...' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
