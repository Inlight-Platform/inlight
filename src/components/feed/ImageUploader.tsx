import React, { useRef, useState } from 'react';
import { ImagePlus, X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Supported image MIME types - comprehensive list
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ImageUploaderProps {
  userId: string;
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  onRemoveImage?: () => void;
  className?: string;
  compact?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  userId,
  onImageUploaded,
  currentImageUrl,
  onRemoveImage,
  className,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Check file type - be more permissive
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    // Check by MIME type first
    if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
      return null;
    }
    
    // Fallback: check by extension for edge cases where MIME type is empty
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif'];
    const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
    
    if (hasValidExtension) {
      return null;
    }

    return 'Please upload an image file (JPG, PNG, GIF, WebP, SVG, etc.)';
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);

    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `posts/${timestamp}-${randomId}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const { error: uploadError, data } = await supabase.storage
        .from('profile-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg', // Fallback content type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(filePath);

      onImageUploaded(urlData.publicUrl);
      toast.success('Image uploaded!');
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (currentImageUrl) {
    return (
      <div className={cn("relative rounded-lg overflow-hidden", className)}>
        <img 
          src={currentImageUrl} 
          alt="Uploaded preview" 
          className="w-full max-h-64 object-cover"
        />
        {onRemoveImage && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={onRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Uploading...' : 'Image'}
        </Button>
      </>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragActive 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-accent/50",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground/70">
              Supports JPG, PNG, GIF, WebP up to 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
