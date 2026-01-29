import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, ImagePlus, Type, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlipbookEntry {
  id: string;
  user_id: string;
  image_url: string | null;
  content: string | null;
  content_type: 'image' | 'text';
  caption: string | null;
  display_order: number;
}

interface WhyIStartedFlipbookProps {
  userId: string;
  isOwnProfile: boolean;
}

export const WhyIStartedFlipbook: React.FC<WhyIStartedFlipbookProps> = ({
  userId,
  isOwnProfile,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textContent, setTextContent] = useState('');

  // Fetch flipbook entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['profile-flipbook', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_flipbook')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as FlipbookEntry[];
    },
    enabled: !!userId,
  });

  const uploadImageMutation = useMutation({
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

      const nextOrder = entries.length > 0 ? Math.max(...entries.map(e => e.display_order)) + 1 : 0;

      const { error: insertError } = await supabase
        .from('profile_flipbook')
        .insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          content_type: 'image',
          display_order: nextOrder,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-flipbook', userId] });
      toast.success('Image added!');
      setShowAddMenu(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload image');
    },
  });

  const addTextMutation = useMutation({
    mutationFn: async (content: string) => {
      const nextOrder = entries.length > 0 ? Math.max(...entries.map(e => e.display_order)) + 1 : 0;

      const { error } = await supabase
        .from('profile_flipbook')
        .insert({
          user_id: userId,
          content: content,
          content_type: 'text',
          display_order: nextOrder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-flipbook', userId] });
      toast.success('Text added!');
      setShowTextInput(false);
      setTextContent('');
      setShowAddMenu(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add text');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('profile_flipbook')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-flipbook', userId] });
      setCurrentIndex(prev => Math.max(0, prev - 1));
      toast.success('Entry removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete entry');
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
      await uploadImageMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddText = async () => {
    if (!textContent.trim()) {
      toast.error('Please enter some text');
      return;
    }
    await addTextMutation.mutateAsync(textContent.trim());
  };

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev === 0 ? entries.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === entries.length - 1 ? 0 : prev + 1));
  };

  // Empty state for non-owner viewing an empty flipbook
  if (entries.length === 0 && !isOwnProfile) {
    return null;
  }

  // Empty state for owner
  if (entries.length === 0 && isOwnProfile) {
    return (
      <div className="relative w-full max-w-[200px]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {/* Header */}
        <div className="mb-2">
          <h3 className="text-xs font-medium text-foreground flex items-center gap-1">
            <Heart className="w-3 h-3 text-primary" />
            Why I Started
          </h3>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Share your humble beginnings
          </p>
        </div>

        {showTextInput ? (
          <div className="space-y-2">
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Share your story..."
              className="min-h-[100px] text-xs resize-none"
              maxLength={500}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddText} disabled={addTextMutation.isPending}>
                {addTextMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTextInput(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="flex-1 aspect-square max-h-[80px] rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/10 transition-all"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4 text-primary" />
              )}
              <span className="text-[9px] text-muted-foreground">Image</span>
            </button>
            <button
              onClick={() => setShowTextInput(true)}
              className="flex-1 aspect-square max-h-[80px] rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/10 transition-all"
            >
              <Type className="w-4 h-4 text-primary" />
              <span className="text-[9px] text-muted-foreground">Text</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const currentEntry = entries[currentIndex];

  return (
    <div className="relative w-full max-w-[200px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-medium text-foreground flex items-center gap-1">
            <Heart className="w-3 h-3 text-primary" />
            Why I Started
          </h3>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Humble beginnings & inspirations
          </p>
        </div>
        {isOwnProfile && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
            {showAddMenu && (
              <div className="absolute right-0 top-7 bg-popover border border-border rounded-md shadow-lg z-10 p-1 min-w-[100px]">
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowAddMenu(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted rounded"
                >
                  <ImagePlus className="w-3 h-3" /> Image
                </button>
                <button
                  onClick={() => { setShowTextInput(true); setShowAddMenu(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted rounded"
                >
                  <Type className="w-3 h-3" /> Text
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text input overlay */}
      {showTextInput && (
        <div className="mb-2 space-y-2">
          <Textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Share your story..."
            className="min-h-[80px] text-xs resize-none"
            maxLength={500}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleAddText} disabled={addTextMutation.isPending}>
              {addTextMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setShowTextInput(false); setTextContent(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Flipbook Container */}
      <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-muted shadow-md group">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : currentEntry ? (
          <>
            {/* Content - Image or Text */}
            {currentEntry.content_type === 'image' && currentEntry.image_url ? (
              <img
                src={currentEntry.image_url}
                alt={`Entry ${currentIndex + 1}`}
                className="w-full h-full object-cover transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full p-3 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <p className="text-xs text-foreground leading-relaxed text-center whitespace-pre-wrap overflow-auto max-h-full">
                  {currentEntry.content}
                </p>
              </div>
            )}

            {/* Delete button for owner */}
            {isOwnProfile && (
              <button
                onClick={() => deleteMutation.mutate(currentEntry.id)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Navigation arrows - only show if more than 1 entry */}
            {entries.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </>
            )}

            {/* Dots indicator */}
            {entries.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {entries.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'w-1 h-1 rounded-full transition-all',
                      idx === currentIndex
                        ? 'bg-white w-2'
                        : 'bg-white/50 hover:bg-white/75'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Entry counter */}
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/40 text-white text-[10px]">
              {currentIndex + 1}/{entries.length}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default WhyIStartedFlipbook;
