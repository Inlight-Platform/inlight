import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';

type MediaType = 'photo' | 'video' | 'audio' | 'document';
type Visibility = 'public' | 'connections' | 'private';

interface UploadedMedia {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: MediaType;
  mime_type: string;
  file_size: number;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  url: string;
  cover_url?: string | null;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const getMediaType = (mimeType: string): MediaType => {
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};

export const useMediaUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const uploadFile = async (
    file: File,
    userId: string,
    visibility: Visibility = 'public'
  ): Promise<UploadedMedia | null> => {
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Compress images before upload
      let processedFile = file;
      if (isCompressibleImage(file)) {
        processedFile = await compressImage(file);
      }

      // Generate unique file path
      const fileExt = processedFile.type === 'image/jpeg' 
        ? 'jpg' 
        : file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${timestamp}-${randomId}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: processedFile.type || file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress({ loaded: file.size, total: file.size, percentage: 100 });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(filePath);

      // Save metadata to database
      const mediaType = getMediaType(file.type);
      
      const { data: mediaRecord, error: dbError } = await supabase
        .from('user_media')
        .insert({
          user_id: userId,
          file_path: filePath,
          file_name: file.name,
          file_type: mediaType,
          mime_type: file.type,
          file_size: file.size,
          visibility,
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: delete uploaded file
        await supabase.storage.from('profile-media').remove([filePath]);
        throw dbError;
      }

      toast.success('File uploaded successfully!');
      
      return {
        ...mediaRecord,
        url: urlData.publicUrl,
      } as UploadedMedia;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      return null;
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const deleteFile = async (mediaId: string, filePath: string): Promise<boolean> => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('profile-media')
        .remove([filePath]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_media')
        .delete()
        .eq('id', mediaId);

      if (dbError) {
        throw dbError;
      }

      toast.success('File deleted successfully!');
      return true;
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete file');
      return false;
    }
  };

  const updateVisibility = async (
    mediaId: string,
    visibility: Visibility
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('user_media')
        .update({ visibility })
        .eq('id', mediaId);

      if (error) throw error;
      
      toast.success('Visibility updated!');
      return true;
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.message || 'Failed to update visibility');
      return false;
    }
  };

  return {
    uploadFile,
    deleteFile,
    updateVisibility,
    uploading,
    progress,
  };
};

export const useUserMedia = (userId: string | undefined) => {
  const fetchMedia = async (): Promise<UploadedMedia[]> => {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('user_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch media error:', error);
      return [];
    }

    // Add public URLs (handle external video links)
    return data.map((item) => ({
      ...item,
      url: item.mime_type === 'video/external' 
        ? item.file_path 
        : supabase.storage.from('profile-media').getPublicUrl(item.file_path).data.publicUrl,
    })) as UploadedMedia[];
  };

  return { fetchMedia };
};
