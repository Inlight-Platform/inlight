import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Image, Film, RotateCcw, Check, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface StoryCreatorProps {
  onClose: () => void;
  onStoryCreated: () => void;
}

type CreatorStep = 'select' | 'capture' | 'preview';
type MediaType = 'image' | 'video';

export const StoryCreator: React.FC<StoryCreatorProps> = ({ onClose, onStoryCreated }) => {
  const [step, setStep] = useState<CreatorStep>('select');
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addStory, currentUserId, addPostDate } = useStore();

  const startCamera = useCallback(async (type: MediaType) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: cameraFacing,
          aspectRatio: 9/16,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: type === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setMediaType(type);
      setStep('capture');
    } catch (error) {
      toast.error('Unable to access camera. Please check permissions.');
      console.error('Camera error:', error);
    }
  }, [cameraFacing]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    stopCamera();
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(newFacing);
    
    if (mediaType) {
      setTimeout(() => startCamera(mediaType), 100);
    }
  }, [cameraFacing, mediaType, startCamera, stopCamera]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setMediaUrl(dataUrl);
        stopCamera();
        setStep('preview');
      }
    }
  }, [stopCamera]);

  const startRecording = useCallback(() => {
    if (streamRef.current) {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        stopCamera();
        setStep('preview');
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 60000);
    }
  }, [stopCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      toast.error('Please select an image or video file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(isVideo ? 'video' : 'image');
    setStep('preview');
  }, []);

  const handlePublish = useCallback(() => {
    if (!mediaUrl || !mediaType) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    addStory({
      userId: currentUserId,
      type: mediaType,
      url: mediaUrl,
      caption: caption.trim() || undefined,
      expiresAt: expiresAt.toISOString(),
      viewedBy: []
    });

    // Update streak
    addPostDate(currentUserId, now.toISOString());

    toast.success('Story posted! It will expire in 24 hours.');
    onStoryCreated();
    onClose();
  }, [mediaUrl, mediaType, caption, addStory, currentUserId, addPostDate, onStoryCreated, onClose]);

  const handleReset = useCallback(() => {
    setMediaUrl(null);
    setMediaType(null);
    setCaption('');
    setShowCaptionInput(false);
    setStep('select');
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        
        {step === 'capture' && (
          <button
            onClick={switchCamera}
            className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            aria-label="Switch camera"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        )}
        
        {step === 'preview' && (
          <button
            onClick={() => setShowCaptionInput(prev => !prev)}
            className={cn(
              "p-2 rounded-full transition-colors",
              showCaptionInput ? "bg-white text-black" : "bg-black/30 text-white hover:bg-black/50"
            )}
            aria-label="Add caption"
          >
            <Type className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center">
        {step === 'select' && (
          <div className="flex flex-col items-center gap-8 px-8">
            <h2 className="text-white text-2xl font-bold text-center">
              Create Your Story
            </h2>
            <p className="text-white/70 text-center">
              Stories disappear after 24 hours
            </p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <button
                onClick={() => startCamera('image')}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white hover:scale-105 transition-transform"
              >
                <Camera className="w-10 h-10" />
                <span className="font-semibold">Photo</span>
              </button>
              
              <button
                onClick={() => startCamera('video')}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white hover:scale-105 transition-transform"
              >
                <Film className="w-10 h-10" />
                <span className="font-semibold">Video</span>
              </button>
            </div>
            
            <div className="w-full max-w-sm">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="font-medium">Upload from gallery</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === 'capture' && (
          <div className="relative w-full max-w-[400px] aspect-[9/16] bg-black overflow-hidden rounded-2xl">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === 'preview' && mediaUrl && (
          <div className="relative w-full max-w-[400px] aspect-[9/16] bg-black overflow-hidden rounded-2xl">
            {mediaType === 'video' ? (
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                loop
              />
            ) : (
              <img 
                src={mediaUrl}
                alt="Story preview"
                className="w-full h-full object-cover"
              />
            )}

            {/* Caption overlay */}
            {caption && (
              <div className="absolute bottom-20 left-4 right-4">
                <p className="text-white text-center font-medium drop-shadow-lg">
                  {caption}
                </p>
              </div>
            )}

            {/* Caption input */}
            {showCaptionInput && (
              <div className="absolute bottom-24 left-4 right-4">
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  maxLength={150}
                  className="bg-black/50 border-white/30 text-white placeholder:text-white/50"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="p-6 flex justify-center">
        {step === 'capture' && (
          <div className="flex items-center gap-6">
            {mediaType === 'image' ? (
              <button
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 transition-transform"
                aria-label="Take photo"
              >
                <div className="w-16 h-16 rounded-full bg-white" />
              </button>
            ) : (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all",
                  isRecording ? "bg-red-500" : "hover:scale-105"
                )}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <div className="w-8 h-8 rounded-sm bg-white" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-500" />
                )}
              </button>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="flex items-center gap-4 w-full max-w-sm">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-12 border-white/30 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake
            </Button>
            <Button
              onClick={handlePublish}
              className="flex-1 h-12 bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white hover:opacity-90"
            >
              <Check className="w-5 h-5 mr-2" />
              Share Story
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
