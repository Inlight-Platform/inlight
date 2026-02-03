import React, { useState, useRef } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoCoverUploaderProps {
  mediaId: string;
  userId: string;
  currentCoverUrl?: string | null;
  onUpdate: () => void;
  trigger?: React.ReactNode;
}

export const VideoCoverUploader: React.FC<VideoCoverUploaderProps> = ({
  mediaId,
  userId,
  currentCoverUrl,
  onUpdate,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Upload cover image
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/video-covers/${mediaId}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update media record
      const { error: updateError } = await supabase
        .from('user_media')
        .update({ cover_url: coverUrl })
        .eq('id', mediaId);

      if (updateError) throw updateError;

      toast.success('Cover image updated!');
      onUpdate();
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload cover');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCover = async () => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from('user_media')
        .update({ cover_url: null })
        .eq('id', mediaId);

      if (error) throw error;

      toast.success('Cover image removed');
      setPreviewUrl(null);
      onUpdate();
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove cover');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="h-8 w-8"
          title="Set cover image"
        >
          <ImagePlus className="w-4 h-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5" />
              Video Cover Image
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a cover image for this video that will display in your gallery.
            </p>

            {/* Current cover preview */}
            {(previewUrl || currentCoverUrl) && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={previewUrl || currentCoverUrl || ''}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}

            {/* Upload button */}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4 mr-2" />
              )}
              {currentCoverUrl ? 'Change Cover Image' : 'Upload Cover Image'}
            </Button>
          </div>

          <DialogFooter>
            {currentCoverUrl && (
              <Button
                variant="destructive"
                onClick={handleRemoveCover}
                disabled={uploading}
              >
                <X className="w-4 h-4 mr-2" />
                Remove Cover
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
