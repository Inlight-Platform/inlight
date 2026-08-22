import React, { useRef, useState } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectImageCropper } from './ProjectImageCropper';

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const COMPRESSION_MAX_WIDTH = 1920;
const COMPRESSION_QUALITY = 0.85;
const COMPRESSION_THRESHOLD = 500 * 1024;
const TARGET_MAX_SIZE = 8 * 1024 * 1024;

interface ProjectHeaderImageUploaderProps {
  userId: string;
  projectId?: string; // Optional for new projects (will use temp path)
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onRemoveImage?: () => void;
  className?: string;
  imageKind?: 'main' | 'header';
  cropTitle?: string;
  helperText?: string;
  recommendedDimensions?: string;
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
}

const compressImage = async (file: File): Promise<File> => {
  const skipTypes = ['image/gif'];
  if (skipTypes.includes(file.type)) return file;
  if (file.size < COMPRESSION_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;
      let maxDimension = COMPRESSION_MAX_WIDTH;
      if (file.size > 20 * 1024 * 1024) maxDimension = 1600;
      else if (file.size > 10 * 1024 * 1024) maxDimension = 1800;

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

      ctx.drawImage(img, 0, 0, width, height);

      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size > TARGET_MAX_SIZE && quality > 0.5) {
              tryCompress(quality - 0.1);
              return;
            }
            if (blob.size >= file.size && file.size < TARGET_MAX_SIZE) {
              resolve(file);
              return;
            }

            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
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
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
};

export const ProjectHeaderImageUploader: React.FC<ProjectHeaderImageUploaderProps> = ({
  userId,
  projectId,
  currentImageUrl,
  onImageUploaded,
  onRemoveImage,
  className,
  imageKind = 'header',
  cropTitle = 'Crop project image',
  helperText = 'Drag and drop or click to upload image',
  recommendedDimensions = 'Recommended: 1920×480 or similar wide format',
  aspect = 4,
  outputWidth = 1920,
  outputHeight = 480,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropperImageSrc, setCropperImageSrc] = useState('');

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 50MB';
    }
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    if (SUPPORTED_IMAGE_TYPES.includes(fileType)) return null;
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif'];
    if (supportedExtensions.some(ext => fileName.endsWith(ext))) return null;
    return 'Please upload an image file (JPG, PNG, GIF, WebP, etc.)';
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
      const processedFile = await compressImage(file);
      setUploadStatus('Uploading...');

      const fileExt = processedFile.type === 'image/jpeg' ? 'jpg' : (processedFile.name.split('.').pop()?.toLowerCase() || 'jpg');
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${imageKind}-${timestamp}-${randomId}.${fileExt}`;
      const folderPath = projectId ? `${userId}/projects/${projectId}` : `${userId}/projects/draft`;
      const filePath = `${folderPath}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: processedFile.type || 'image/jpeg',
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(filePath);

      onImageUploaded(urlData.publicUrl);
      toast.success('Header image uploaded!');
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
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedFile(file);
          setCropperImageSrc(reader.result as string);
          setCropperOpen(true);
        };
        reader.readAsDataURL(file);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedFile(file);
          setCropperImageSrc(reader.result as string);
          setCropperOpen(true);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleCropComplete = async (blob: Blob) => {
    const sourceFile = selectedFile ?? new File([blob], `${imageKind}.jpg`, { type: 'image/jpeg' });
    const croppedFile = new File([blob], sourceFile.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    await uploadFile(croppedFile);
    setSelectedFile(null);
    setCropperImageSrc('');
  };

  if (currentImageUrl) {
    return (
      <div className={cn("relative rounded-lg overflow-hidden", className)}>
        <img
          src={currentImageUrl}
          alt="Header preview"
          className="w-full object-cover"
          style={{ aspectRatio: `${aspect}` }}
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

  return (
    <div className={className}>
      <ProjectImageCropper
        open={cropperOpen}
        onClose={() => {
          setCropperOpen(false);
          setSelectedFile(null);
          setCropperImageSrc('');
        }}
        imageSrc={cropperImageSrc}
        onCropComplete={handleCropComplete}
        title={cropTitle}
        aspect={aspect}
        outputWidth={outputWidth}
        outputHeight={outputHeight}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        onClick={() => fileInputRef.current?.click()}
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
              {helperText}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {recommendedDimensions}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
