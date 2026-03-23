import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Story, useStore } from '@/store/useStore';
import { formatDistanceToNow } from 'date-fns';

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ 
  stories, 
  initialIndex = 0, 
  onClose 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getUser, markStoryViewed, currentUserId } = useStore();

  const currentStory = stories[currentIndex];
  const storyUser = currentStory ? getUser(currentStory.userId) : null;
  const STORY_DURATION = currentStory?.type === 'video' ? 15000 : 5000; // 15s for video, 5s for image

  useEffect(() => {
    if (currentStory) {
      markStoryViewed(currentStory.id, currentUserId);
    }
  }, [currentStory?.id]);

  useEffect(() => {
    if (isPaused) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (videoRef.current && currentStory?.type === 'video') {
        videoRef.current.pause();
      }
      return;
    }

    if (videoRef.current && currentStory?.type === 'video') {
      videoRef.current.play();
    }

    setProgress(0);
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, isPaused, STORY_DURATION]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case 'Escape':
        onClose();
        break;
      case ' ':
        e.preventDefault();
        setIsPaused(prev => !prev);
        break;
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  if (!currentStory || !storyUser) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Story viewer"
    >
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {stories.map((_, idx) => (
          <div 
            key={idx} 
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div 
              className="h-full bg-white transition-all duration-100"
              style={{ 
                width: idx < currentIndex ? '100%' : 
                       idx === currentIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img 
            src={storyUser.avatar} 
            alt={storyUser.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-white"
          />
          <div>
            <p className="text-white font-semibold text-sm">{storyUser.name}</p>
            <p className="text-white/70 text-xs">
              {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true })}
              {' • '}
              {getTimeRemaining(currentStory.expiresAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(prev => !prev)}
            className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          {currentStory.type === 'video' && (
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Story content - 9:16 aspect ratio */}
      <div className="relative w-full max-w-[400px] aspect-[9/16] bg-black">
        {currentStory.type === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.url}
            className="w-full h-full object-cover"
            muted={isMuted}
            playsInline
            autoPlay
            loop={false}
          />
        ) : (
          <img 
            src={currentStory.url}
            alt="Story"
            className="w-full h-full object-cover"
          />
        )}

        {/* Caption overlay */}
        {currentStory.caption && (
          <div className="absolute bottom-20 left-4 right-4">
            <p className="text-white text-center font-medium drop-shadow-lg">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Navigation touch areas */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3 opacity-0"
          onClick={goToPrevious}
          aria-label="Previous story"
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3 opacity-0"
          onClick={goToNext}
          aria-label="Next story"
        />
      </div>

      {/* Desktop navigation arrows */}
      <button
        onClick={goToPrevious}
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full",
          "bg-white/20 text-white hover:bg-white/30 transition-colors",
          "hidden md:flex items-center justify-center",
          currentIndex === 0 && "opacity-50 cursor-not-allowed"
        )}
        disabled={currentIndex === 0}
        aria-label="Previous story"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={goToNext}
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full",
          "bg-white/20 text-white hover:bg-white/30 transition-colors",
          "hidden md:flex items-center justify-center"
        )}
        aria-label="Next story"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};
