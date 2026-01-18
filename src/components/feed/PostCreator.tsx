import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Send, X, Calendar, Briefcase, MessageSquare, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface PostCreatorProps {
  userProfile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  defaultOpen?: boolean;
  onClose?: () => void;
}

type PostType = 'update' | 'event' | 'job';

export const PostCreator: React.FC<PostCreatorProps> = ({ userProfile, defaultOpen = false, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>('update');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');

  const resetForm = () => {
    setContent('');
    setTitle('');
    setImageUrl('');
    setShowImageInput(false);
    setLocation('');
    setEventDate('');
    setEventType('');
    setPostType('update');
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      
      if (postType === 'update') {
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: content.trim(),
            image_url: imageUrl.trim() || null,
          });
        if (error) throw error;
      } else if (postType === 'event') {
        const { error } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            title: title.trim(),
            description: content.trim() || null,
            event_date: eventDate,
            location: location.trim() || null,
            event_type: eventType.trim() || 'General',
            image_url: imageUrl.trim() || null,
          });
        if (error) throw error;
      } else if (postType === 'job') {
        // For now, jobs are stored as posts with a special format
        // In the future, you could create a dedicated opportunities table
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: `🎯 **${title.trim()}**\n\n${content.trim()}${location ? `\n\n📍 ${location}` : ''}`,
            image_url: imageUrl.trim() || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed-events'] });
      toast.success(
        postType === 'update' ? 'Post created!' : 
        postType === 'event' ? 'Event created!' : 
        'Job opportunity posted!'
      );
      onClose?.();
    },
    onError: () => toast.error('Failed to create post'),
  });

  const handleSubmit = () => {
    if (postType === 'update' && !content.trim()) return;
    if (postType === 'event' && (!title.trim() || !eventDate)) return;
    if (postType === 'job' && (!title.trim() || !content.trim())) return;
    createPostMutation.mutate();
  };

  const isValid = () => {
    if (postType === 'update') return content.trim().length > 0;
    if (postType === 'event') return title.trim().length > 0 && eventDate.length > 0;
    if (postType === 'job') return title.trim().length > 0 && content.trim().length > 0;
    return false;
  };

  if (!user) return null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={userProfile?.avatar_url || undefined} />
            <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-4">
            {/* Post Type Tabs */}
            <Tabs value={postType} onValueChange={(v) => setPostType(v as PostType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="update" className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Update
                </TabsTrigger>
                <TabsTrigger value="event" className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Event
                </TabsTrigger>
                <TabsTrigger value="job" className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  Job
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Title field for events and jobs */}
            {(postType === 'event' || postType === 'job') && (
              <Input
                placeholder={postType === 'event' ? 'Event title...' : 'Job title...'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}

            {/* Content textarea */}
            <Textarea
              placeholder={
                postType === 'update' ? "Share something with your network..." :
                postType === 'event' ? "Describe your event..." :
                "Describe the opportunity..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none"
            />

            {/* Event-specific fields */}
            {postType === 'event' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Date & Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </label>
                  <Input
                    placeholder="Location..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Job-specific fields */}
            {postType === 'job' && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Location (optional)
                </label>
                <Input
                  placeholder="Remote, NYC, LA..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            )}

            {/* Event type for events */}
            {postType === 'event' && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Event Type</label>
                <Input
                  placeholder="Workshop, Networking, Performance..."
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                />
              </div>
            )}
            
            {showImageInput && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Image URL (optional)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowImageInput(false);
                    setImageUrl('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden max-h-48">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImageInput(!showImageInput)}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Image
              </Button>
              <div className="flex items-center gap-2">
                {onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetForm();
                      onClose();
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!isValid() || createPostMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {postType === 'update' ? 'Post' : postType === 'event' ? 'Create Event' : 'Post Job'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};