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

// Max file size before compression: 50MB (will be compressed down)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Compression settings
const COMPRESSION_MAX_WIDTH = 1920;
const COMPRESSION_MAX_HEIGHT = 1920;
const COMPRESSION_QUALITY = 0.85;
const COMPRESSION_THRESHOLD = 500 * 1024; // Compress if > 500KB
const TARGET_MAX_SIZE = 8 * 1024 * 1024; // Target max 8MB after compression

interface ImageUploaderProps {
  userId: string;
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  onRemoveImage?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Compresses an image file using Canvas API with progressive quality reduction
 * Returns the original file if compression isn't needed or fails
 */
const compressImage = async (file: File): Promise<File> => {
  // Skip compression for GIFs and SVGs (they don't compress well with canvas)
  const skipTypes = ['image/gif', 'image/svg+xml'];
  if (skipTypes.includes(file.type)) {
    return file;
  }

  // For small files, skip unless they're over threshold
  if (file.size < COMPRESSION_THRESHOLD) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      // For very large files, be more aggressive with resizing
      let maxDimension = COMPRESSION_MAX_WIDTH;
      if (file.size > 20 * 1024 * 1024) {
        maxDimension = 1600; // Reduce more for huge files
      } else if (file.size > 10 * 1024 * 1024) {
        maxDimension = 1800;
      }
      
      if (width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      }
      
      if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Progressive compression: try different quality levels
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // If still too large and quality > 0.5, try lower quality
            if (blob.size > TARGET_MAX_SIZE && quality > 0.5) {
              tryCompress(quality - 0.1);
              return;
            }

            // If compression made it bigger, use original (only for small files)
            if (blob.size >= file.size && file.size < TARGET_MAX_SIZE) {
              resolve(file);
              return;
            }

            // Create new file with compressed blob
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            const originalMB = (file.size / 1024 / 1024).toFixed(2);
            const compressedMB = (blob.size / 1024 / 1024).toFixed(2);
            const savings = Math.round((1 - blob.size / file.size) * 100);
            console.log(`Image compressed: ${originalMB}MB → ${compressedMB}MB (${savings}% smaller, quality: ${quality})`);
            
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress(COMPRESSION_QUALITY);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file); // Return original on error
    };

    img.src = URL.createObjectURL(file);
  });
};

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
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    // Check file size - allow up to 50MB, will be compressed
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 50MB (will be auto-compressed)`;
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
    setUploadStatus('Compressing...');

    try {
      // Compress the image first
      const processedFile = await compressImage(file);
      
      setUploadStatus('Uploading...');

      // Generate unique file path
      const fileExt = processedFile.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `posts/${timestamp}-${randomId}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: processedFile.type || 'image/jpeg',
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
      setUploadStatus('');
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
          {uploading ? uploadStatus || 'Uploading...' : 'Image'}
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
            <p className="text-sm text-muted-foreground">{uploadStatus || 'Processing...'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground/70">
              Images auto-compressed for fast uploads
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
