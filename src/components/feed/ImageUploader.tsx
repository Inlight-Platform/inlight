import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ImagePlus, X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SUPPORTED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/avif', 'image/heic', 'image/heif',
];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif'];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const COMPRESSION_THRESHOLD = 500 * 1024; // compress if > 500 KB
const TARGET_MAX_SIZE = 8 * 1024 * 1024; // 8 MB after compression
const MAX_IMAGES = 4;

const compressImage = async (file: File): Promise<File> => {
  if (['image/gif'].includes(file.type)) return file;
  if (file.size < COMPRESSION_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width, height } = img;
      const maxDim = file.size > 20 * 1024 * 1024 ? 1600 : file.size > 10 * 1024 * 1024 ? 1800 : 1920;
      if (width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
      if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }

      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      const tryCompress = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size > TARGET_MAX_SIZE && quality > 0.5) { tryCompress(quality - 0.1); return; }
          if (blob.size >= file.size && file.size < TARGET_MAX_SIZE) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', quality);
      };
      tryCompress(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); };
    img.src = URL.createObjectURL(file);
  });
};

const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE)
    return `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (SUPPORTED_MIME_TYPES.includes(type)) return null;
  if (SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return null;
  return `"${file.name}" is not a supported image type. Use JPG, PNG, GIF, WebP, AVIF, or HEIC.`;
};

interface ImageUploaderProps {
  userId: string;
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  onRemoveImage?: () => void;
  className?: string;
  compact?: boolean;
  currentCount?: number;
}

export interface ImageUploaderHandle {
  trigger: () => void;
}

export const ImageUploader = forwardRef<ImageUploaderHandle, ImageUploaderProps>(({
  userId,
  onImageUploaded,
  currentImageUrl,
  onRemoveImage,
  className,
  compact = false,
  currentCount = 0,
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ trigger: () => fileInputRef.current?.click() }));
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const remaining = MAX_IMAGES - currentCount;
  const atLimit = remaining <= 0;

  const uploadFile = async (file: File): Promise<string | null> => {
    const err = validateFile(file);
    if (err) { toast.error(err); return null; }

    try {
      const processed = await compressImage(file);
      const ext = processed.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
      const path = `${userId}/posts/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(path, processed, { cacheControl: '3600', upsert: false, contentType: processed.type || 'image/jpeg' });
      if (uploadError) {
        if (uploadError.message.includes('security') || uploadError.message.includes('policy'))
          throw new Error('Upload permission denied. Please sign in and try again.');
        if (uploadError.message.includes('size') || uploadError.message.includes('large'))
          throw new Error('File is too large even after compression. Try a smaller image.');
        throw new Error(uploadError.message || 'Upload failed. Check your connection and try again.');
      }
      const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      toast.error(e.message || 'Upload failed. Check your connection and try again.');
      return null;
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, remaining);
    if (arr.length === 0) return;
    if (atLimit) { toast.error(`Maximum ${MAX_IMAGES} images per post.`); return; }

    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < arr.length; i++) {
      setUploadStatus(`Uploading ${i + 1} of ${arr.length}…`);
      const url = await uploadFile(arr[i]);
      if (url) { onImageUploaded(url); uploaded++; }
    }
    setUploading(false);
    setUploadStatus('');
    if (uploaded > 0) toast.success(uploaded === 1 ? 'Image added!' : `${uploaded} images added!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  if (currentImageUrl) {
    return (
      <div className={cn('relative rounded-lg overflow-hidden', className)}>
        <img src={currentImageUrl} alt="Uploaded preview" className="w-full max-h-64 object-cover" />
        {onRemoveImage && (
          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={onRemoveImage}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || atLimit}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
          {uploading ? uploadStatus || 'Uploading…' : atLimit ? 'Max images' : 'Image'}
        </Button>
      </>
    );
  }

  return (
    <div className={className}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      <div
        onClick={() => !atLimit && fileInputRef.current?.click()}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          atLimit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50',
          uploading && 'pointer-events-none opacity-50',
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{uploadStatus || 'Processing…'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {atLimit ? `Maximum ${MAX_IMAGES} images reached` : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              JPG, PNG, GIF, WebP, AVIF, HEIC · up to 50 MB each · {remaining} of {MAX_IMAGES} slots remaining
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
