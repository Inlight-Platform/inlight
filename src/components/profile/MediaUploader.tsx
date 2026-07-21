import React, { useRef, useState } from 'react';
import { Plus, Upload, X, Loader2, Image, Video, Music, FileText, Eye, EyeOff, Users, Trash2, ImagePlus, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useQueryClient } from '@tanstack/react-query';
import { VideoLinkUploader } from './VideoLinkUploader';
import { VideoCoverUploader } from './VideoCoverUploader';

type MediaType = 'photo' | 'video' | 'audio' | 'document';
type Visibility = 'public' | 'connections' | 'private';

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: MediaType;
  mime_type: string;
  visibility: Visibility;
  url: string;
  cover_url?: string | null;
}

interface MediaUploaderProps {
  userId: string;
  mediaType: MediaType;
  items: MediaItem[];
  onUploadComplete: () => void;
  onDelete: (id: string, filePath: string) => Promise<void>;
  onVisibilityChange: (id: string, visibility: Visibility) => Promise<void>;
}

const acceptTypes: Record<MediaType, string> = {
  photo: 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif',
  video: 'video/mp4,video/webm,video/quicktime',
  audio: 'audio/mpeg,audio/wav,audio/mp3',
  document: 'application/pdf',
};

const getMediaIcon = (type: MediaType) => {
  switch (type) {
    case 'photo': return Image;
    case 'video': return Video;
    case 'audio': return Music;
    case 'document': return FileText;
  }
};

const getVisibilityIcon = (visibility: Visibility) => {
  switch (visibility) {
    case 'public': return <Eye className="w-4 h-4" />;
    case 'connections': return <Users className="w-4 h-4" />;
    case 'private': return <EyeOff className="w-4 h-4" />;
  }
};

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  userId,
  mediaType,
  items,
  onUploadComplete,
  onDelete,
  onVisibilityChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { uploadFile, uploading, progress } = useMediaUpload();
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Upload all files
    const uploadPromises = Array.from(files).map(file => 
      uploadFile(file, userId, 'public')
    );
    
    await Promise.all(uploadPromises);
    
    // Invalidate query to force refetch and show new uploads immediately
    await queryClient.invalidateQueries({ queryKey: ['user-media', userId] });
    
    onUploadComplete();
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (item: MediaItem) => {
    setDeleting(item.id);
    await onDelete(item.id, item.file_path);
    setDeleting(null);
    setLightboxItem(null);
  };

  const MediaIcon = getMediaIcon(mediaType);

  const renderMediaItem = (item: MediaItem) => {
    const isDeleting = deleting === item.id;

    if (mediaType === 'photo') {
      return (
        <div key={item.id} className="relative group aspect-square">
          <img
            src={item.url}
            alt={item.file_name}
            className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setLightboxItem(item)}
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background">
                  {getVisibilityIcon(item.visibility)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50">
                <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'public')}>
                  <Eye className="w-4 h-4 mr-2" /> Public
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'connections')}>
                  <Users className="w-4 h-4 mr-2" /> Connections Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'private')}>
                  <EyeOff className="w-4 h-4 mr-2" /> Private
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button 
              className="p-1.5 rounded-full bg-destructive/80 backdrop-blur-sm hover:bg-destructive text-destructive-foreground"
              onClick={() => handleDelete(item)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      );
    }

    if (mediaType === 'video') {
      const isExternalLink = item.mime_type === 'video/external';
      
      return (
        <div key={item.id} className="relative group aspect-[9/16] bg-muted rounded-lg overflow-hidden">
          {/* Show cover image if available, otherwise show video thumbnail or placeholder */}
          {item.cover_url ? (
            <img
              src={item.cover_url}
              alt={item.file_name}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxItem(item)}
            />
          ) : isExternalLink ? (
            <div 
              className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20 cursor-pointer"
              onClick={() => setLightboxItem(item)}
            >
              <ExternalLink className="w-8 h-8 text-muted-foreground" />
            </div>
          ) : (
            <video
              src={item.url}
              className="w-full h-full object-cover cursor-pointer"
              muted
              playsInline
              onClick={() => setLightboxItem(item)}
            />
          )}
          
          {/* Play indicator */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/20 pointer-events-none">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
          
          {/* Video name */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
            <p className="text-xs text-white truncate">{item.file_name}</p>
          </div>
          
          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <VideoCoverUploader
              mediaId={item.id}
              userId={userId}
              currentCoverUrl={item.cover_url}
              onUpdate={onUploadComplete}
              trigger={
                <button 
                  className="p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background text-foreground"
                  title="Set cover image"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              }
            />
            <button 
              className="p-1.5 rounded-full bg-destructive/80 backdrop-blur-sm hover:bg-destructive text-destructive-foreground"
              onClick={() => handleDelete(item)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      );
    }

    // Audio and Document
    return (
      <div key={item.id} className="p-4 rounded-lg bg-card border border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-muted">
            <MediaIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <span className="font-medium truncate">{item.file_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {getVisibilityIcon(item.visibility)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border-border z-50">
              <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'public')}>
                <Eye className="w-4 h-4 mr-2" /> Public
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'connections')}>
                <Users className="w-4 h-4 mr-2" /> Connections Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityChange(item.id, 'private')}>
                <EyeOff className="w-4 h-4 mr-2" /> Private
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {mediaType === 'audio' && (
            <Button variant="outline" size="sm" onClick={() => setLightboxItem(item)}>
              Play
            </Button>
          )}
          {mediaType === 'document' && (
            <Button variant="outline" size="sm" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer">View</a>
            </Button>
          )}
          <Button 
            variant="destructive" 
            size="icon"
            className="h-8 w-8"
            onClick={() => handleDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  };

  const renderUploadButton = () => {
    if (mediaType === 'photo') {
      return (
        <button 
          className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-accent transition-colors disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              {progress && <span className="text-xs text-muted-foreground">{progress.percentage}%</span>}
            </>
          ) : (
            <>
              <Plus className="w-8 h-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add Photo</span>
            </>
          )}
        </button>
      );
    }

    if (mediaType === 'video') {
      return (
        <button 
          className="aspect-[9/16] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-accent transition-colors disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              {progress && <span className="text-xs text-muted-foreground">{progress.percentage}%</span>}
            </>
          ) : (
            <>
              <Plus className="w-8 h-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add Video</span>
            </>
          )}
        </button>
      );
    }

    const labels: Record<MediaType, string> = {
      photo: 'Upload Photo',
      video: 'Upload Video',
      audio: 'Upload Audio (MP3/WAV)',
      document: 'Upload Résumé (PDF)',
    };

    return (
      <button 
        className="w-full p-8 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-accent transition-colors disabled:opacity-50"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            {progress && (
              <div className="w-full max-w-xs">
                <Progress value={progress.percentage} className="h-2" />
                <span className="text-xs text-muted-foreground mt-1">{progress.percentage}%</span>
              </div>
            )}
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{labels[mediaType]}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes[mediaType]}
        multiple={mediaType === 'photo'}
        onChange={handleFileSelect}
        className="hidden"
      />

      {mediaType === 'photo' && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {items.map(renderMediaItem)}
          {renderUploadButton()}
        </div>
      )}

      {mediaType === 'video' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <VideoLinkUploader userId={userId} onComplete={onUploadComplete} />
          </div>
          {items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map(renderMediaItem)}
            </div>
          )}
        </div>
      )}

      {(mediaType === 'audio' || mediaType === 'document') && (
        <div className="space-y-4">
          {items.map(renderMediaItem)}
          {renderUploadButton()}
        </div>
      )}

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
              lightboxItem?.mime_type === 'video/external' ? (
                <div className="flex flex-col items-center gap-4 p-8">
                  <p className="text-muted-foreground">External video link</p>
                  <a 
                    href={lightboxItem.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Video
                  </a>
                </div>
              ) : (
                <video
                  src={lightboxItem.url}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] rounded-lg"
                />
              )
            )}
            {lightboxItem?.file_type === 'audio' && (
              <div className="p-8">
                <audio src={lightboxItem.url} controls autoPlay className="w-full" />
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-2">
              {getVisibilityIcon(lightboxItem?.visibility || 'public')}
              <span className="text-sm text-muted-foreground capitalize">{lightboxItem?.visibility}</span>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => lightboxItem && handleDelete(lightboxItem)}
              disabled={deleting === lightboxItem?.id}
            >
              {deleting === lightboxItem?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
