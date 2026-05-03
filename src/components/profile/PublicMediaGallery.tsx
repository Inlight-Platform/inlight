import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image, Video, Music, FileText, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type MediaType = 'photo' | 'video' | 'audio' | 'document';

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: MediaType;
  mime_type: string;
  visibility: string;
  url: string;
}

interface PublicMediaGalleryProps {
  userId: string;
  isConnected?: boolean;
}

export const PublicMediaGallery: React.FC<PublicMediaGalleryProps> = ({ 
  userId, 
  isConnected = false 
}) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const fetchPublicMedia = async () => {
      if (!userId) return;

      try {
        // Fetch media that's either public, or connections-only if connected
        let query = supabase
          .from('user_media')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (isConnected) {
          query = query.in('visibility', ['public', 'connections']);
        } else {
          query = query.eq('visibility', 'public');
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching media:', error);
          return;
        }

        // Add URLs
        const mediaWithUrls = (data || []).filter((item): item is typeof item => Boolean(item?.id && item?.file_path)).map((item) => ({
          ...item,
          file_type: item.file_type as MediaType,
          url: supabase.storage.from('profile-media').getPublicUrl(item.file_path).data.publicUrl,
        }));

        setMedia(mediaWithUrls);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicMedia();
  }, [userId, isConnected]);

  const photos = media.filter(m => m.file_type === 'photo');
  const videos = media.filter(m => m.file_type === 'video');
  const audioFiles = media.filter(m => m.file_type === 'audio');
  const documents = media.filter(m => m.file_type === 'document');

  const hasMedia = media.length > 0;

  if (loading) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-xl font-display font-semibold mb-4">Media</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!hasMedia) {
    return null;
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
      <h2 className="text-xl font-display font-semibold mb-4">Media</h2>

      <Tabs defaultValue="photos" className="w-full">
        <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 max-w-md">
            <TabsTrigger value="photos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Photos</span>
              {photos.length > 0 && <span className="text-xs">({photos.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Videos</span>
              {videos.length > 0 && <span className="text-xs">({videos.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">Audio</span>
              {audioFiles.length > 0 && <span className="text-xs">({audioFiles.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Docs</span>
              {documents.length > 0 && <span className="text-xs">({documents.length})</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="photos" className="mt-6">
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="relative aspect-square cursor-pointer group"
                  onClick={() => setLightboxItem(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover rounded-lg transition-opacity group-hover:opacity-90"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No photos to display</p>
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          {videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div 
                  key={video.id} 
                  className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => setLightboxItem(video)}
                >
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30 group-hover:bg-background/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-background/80 flex items-center justify-center">
                      <Play className="w-6 h-6 text-foreground fill-current" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No videos to display</p>
          )}
        </TabsContent>

        <TabsContent value="audio" className="mt-6">
          {audioFiles.length > 0 ? (
            <div className="space-y-3">
              {audioFiles.map((audio) => (
                <div key={audio.id} className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium truncate">{audio.file_name}</span>
                  </div>
                  <audio src={audio.url} controls className="w-full" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No audio files to display</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-lg bg-card border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium truncate">{doc.file_name}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">View</a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No documents to display</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      <Dialog open={!!lightboxItem} onOpenChange={() => setLightboxItem(null)}>
        <DialogContent className="max-w-4xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{lightboxItem?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {lightboxItem?.file_type === 'photo' && (
              <img
                src={lightboxItem.url}
                alt={lightboxItem.file_name}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
            {lightboxItem?.file_type === 'video' && (
              <video
                src={lightboxItem.url}
                controls
                autoPlay
                className="w-full max-h-[70vh] rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
