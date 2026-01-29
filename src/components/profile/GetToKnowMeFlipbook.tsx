import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, ImagePlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlipbookPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
}

interface GetToKnowMeFlipbookProps {
  userId: string;
  isOwnProfile: boolean;
}

export const GetToKnowMeFlipbook: React.FC<GetToKnowMeFlipbookProps> = ({
  userId,
  isOwnProfile,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Fetch flipbook photos
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['profile-flipbook', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_flipbook')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as FlipbookPhoto[];
    },
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${userId}/flipbook/${timestamp}-${randomId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.display_order)) + 1 : 0;

      const { error: insertError } = await supabase
        .from('profile_flipbook')
        .insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          display_order: nextOrder,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-flipbook', userId] });
      toast.success('Photo added to your flipbook!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload photo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('profile_flipbook')
        .delete()
        .eq('id', photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-flipbook', userId] });
      setCurrentIndex(prev => Math.max(0, prev - 1));
      toast.success('Photo removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete photo');
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  // Empty state for non-owner viewing an empty flipbook
  if (photos.length === 0 && !isOwnProfile) {
    return null;
  }

  // Empty state for owner
  if (photos.length === 0 && isOwnProfile) {
    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="w-full max-w-[280px] aspect-[4/5] rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/15 transition-all cursor-pointer group"
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : (
              <Sparkles className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="text-center px-4">
            <p className="font-medium text-sm text-foreground">Get to Know Me</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add photos that show your personality
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="relative w-full max-w-[280px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Get to Know Me
        </h3>
        {isOwnProfile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </Button>
        )}
      </div>

      {/* Flipbook Container */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-muted shadow-lg group">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentPhoto ? (
          <>
            {/* Photo */}
            <img
              src={currentPhoto.image_url}
              alt={`Photo ${currentIndex + 1}`}
              className="w-full h-full object-cover transition-transform duration-300"
            />

            {/* Delete button for owner */}
            {isOwnProfile && (
              <button
                onClick={() => deleteMutation.mutate(currentPhoto.id)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Navigation arrows - only show if more than 1 photo */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Dots indicator */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all',
                      idx === currentIndex
                        ? 'bg-white w-3'
                        : 'bg-white/50 hover:bg-white/75'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Photo counter */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/40 text-white text-xs">
              {currentIndex + 1} / {photos.length}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default GetToKnowMeFlipbook;
