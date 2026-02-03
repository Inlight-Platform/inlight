/**
 * Shared image compression utility
 * Used across all image uploaders for consistent compression behavior
 */

// Compression settings
const COMPRESSION_MAX_WIDTH = 1920;
const COMPRESSION_MAX_HEIGHT = 1920;
const COMPRESSION_QUALITY = 0.85;
const COMPRESSION_THRESHOLD = 500 * 1024; // Compress if > 500KB
const TARGET_MAX_SIZE = 8 * 1024 * 1024; // Target max 8MB after compression

/**
 * Compresses an image file using Canvas API with progressive quality reduction
 * Returns the original file if compression isn't needed or fails
 */
export const compressImage = async (file: File): Promise<File> => {
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

/**
 * Check if a file is an image that can be compressed
 */
export const isCompressibleImage = (file: File): boolean => {
  const imageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif',
  ];
  return imageTypes.includes(file.type.toLowerCase());
};
