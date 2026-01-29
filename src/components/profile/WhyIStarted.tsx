import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, X, Loader2, Image, FileText, Type, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FlipbookEntry {
  id: string;
  user_id: string;
  image_url: string | null;
  content: string | null;
  content_type: string;
  caption: string | null;
  display_order: number;
}

interface WhyIStartedProps {
  userId: string;
  isOwnProfile: boolean;
}

export const WhyIStarted: React.FC<WhyIStartedProps> = ({
  userId,
  isOwnProfile,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const [newCaption, setNewCaption] = useState('');

  // Fetch entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['why-i-started', userId],
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
      const fileName = `${userId}/why-i-started/${timestamp}-${randomId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const nextOrder = entries.length;

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
      queryClient.invalidateQueries({ queryKey: ['why-i-started', userId] });
      toast.success('Photo added!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload photo');
    },
  });

  const addTextMutation = useMutation({
    mutationFn: async ({ content, caption }: { content: string; caption?: string }) => {
      const nextOrder = entries.length;

      const { error } = await supabase
        .from('profile_flipbook')
        .insert({
          user_id: userId,
          content,
          content_type: 'text',
          caption: caption || null,
          display_order: nextOrder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['why-i-started', userId] });
      setNewTextContent('');
      setNewCaption('');
      setAddDialogOpen(false);
      toast.success('Entry added!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add entry');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: FlipbookEntry) => {
      // Delete image from storage if exists
      if (entry.image_url) {
        const path = entry.image_url.split('/profile-media/')[1];
        if (path) {
          await supabase.storage.from('profile-media').remove([path]);
        }
      }

      const { error } = await supabase
        .from('profile_flipbook')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['why-i-started', userId] });
      toast.success('Entry removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove entry');
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleAddText = () => {
    if (!newTextContent.trim()) {
      toast.error('Please enter some content');
      return;
    }
    addTextMutation.mutate({ content: newTextContent.trim(), caption: newCaption.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Why I Started</h3>
          <p className="text-sm text-muted-foreground">
            Share your humble beginnings and inspirations
          </p>
        </div>
        
        {isOwnProfile && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Image className="w-4 h-4 mr-1" />
                  Add Photo
                </>
              )}
            </Button>
            
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Type className="w-4 h-4 mr-1" />
                  Add Text
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Your Story</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Your Story
                    </label>
                    <Textarea
                      value={newTextContent}
                      onChange={(e) => setNewTextContent(e.target.value)}
                      placeholder="Share what inspired you to become an artist, a pivotal moment in your journey, or what drives your passion..."
                      className="min-h-[150px]"
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {newTextContent.length}/2000
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Title (optional)
                    </label>
                    <input
                      type="text"
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      placeholder="e.g., My First Role, The Moment Everything Changed..."
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      maxLength={100}
                    />
                  </div>
                  <Button 
                    onClick={handleAddText} 
                    className="w-full"
                    disabled={addTextMutation.isPending}
                  >
                    {addTextMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add Entry
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {isOwnProfile 
              ? "Share your journey—add photos or stories about what inspired you to become an artist."
              : "No stories shared yet."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <div 
              key={entry.id} 
              className={cn(
                "relative group rounded-lg border border-border overflow-hidden bg-card",
                entry.content_type === 'text' && "p-4"
              )}
            >
              {entry.content_type === 'image' && entry.image_url ? (
                <div className="aspect-[4/3] relative">
                  <img
                    src={entry.image_url}
                    alt={entry.caption || 'Story photo'}
                    className="w-full h-full object-cover"
                  />
                  {entry.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-white text-sm">{entry.caption}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[150px]">
                  {entry.caption && (
                    <h4 className="font-semibold text-sm mb-2">{entry.caption}</h4>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {entry.content}
                  </p>
                </div>
              )}
              
              {isOwnProfile && (
                <button
                  onClick={() => deleteMutation.mutate(entry)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
