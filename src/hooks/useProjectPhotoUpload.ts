import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const useProjectPhotoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const uploadPhoto = async (
    file: File,
    projectId: string,
    userId: string,
    caption?: string
  ): Promise<{ id: string; image_url: string } | null> => {
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Generate unique file path for project photos
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${timestamp}-${randomId}.${fileExt}`;
      const filePath = `projects/${projectId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress({ loaded: file.size, total: file.size, percentage: 100 });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(filePath);

      // Save to project_photos table
      const { data: photoRecord, error: dbError } = await supabase
        .from('project_photos')
        .insert({
          project_id: projectId,
          user_id: userId,
          image_url: urlData.publicUrl,
          caption: caption?.trim() || null,
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: delete uploaded file
        await supabase.storage.from('profile-media').remove([filePath]);
        throw dbError;
      }

      toast.success('Photo uploaded successfully!');
      
      return {
        id: photoRecord.id,
        image_url: urlData.publicUrl,
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
      return null;
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return {
    uploadPhoto,
    uploading,
    progress,
  };
};
