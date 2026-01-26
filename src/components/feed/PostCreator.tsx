import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, X, Calendar, Briefcase, MessageSquare, MapPin, Clock, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ProjectWizard } from './ProjectWizard';
import { ImageUploader } from './ImageUploader';

export type PostType = 'update' | 'event' | 'job' | 'project';

interface PostCreatorProps {
  userProfile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  defaultOpen?: boolean;
  defaultPostType?: PostType;
  onClose?: () => void;
}

export const PostCreator: React.FC<PostCreatorProps> = ({ userProfile, defaultOpen = false, defaultPostType = 'update', onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>(defaultPostType);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [showProjectWizard, setShowProjectWizard] = useState(false);

  // Update postType when defaultPostType changes (for when dialog reopens with different type)
  useEffect(() => {
    setPostType(defaultPostType);
    if (defaultPostType === 'project') {
      setShowProjectWizard(true);
    }
  }, [defaultPostType]);

  const resetForm = () => {
    setContent('');
    setTitle('');
    setImageUrl('');
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
            image_url: imageUrl || null,
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
            image_url: imageUrl || null,
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
            image_url: imageUrl || null,
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

  const handlePostTypeChange = (value: string) => {
    const newType = value as PostType;
    setPostType(newType);
    if (newType === 'project') {
      setShowProjectWizard(true);
    }
  };

  const handleProjectWizardClose = () => {
    setShowProjectWizard(false);
    setPostType('update');
    onClose?.();
  };

  if (!user) return null;

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              {/* Post Type Tabs */}
              <Tabs value={postType} onValueChange={handlePostTypeChange}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="update" className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Update</span>
                  </TabsTrigger>
                  <TabsTrigger value="event" className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Event</span>
                  </TabsTrigger>
                  <TabsTrigger value="job" className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span className="hidden sm:inline">Job</span>
                  </TabsTrigger>
                  <TabsTrigger value="project" className="flex items-center gap-1.5">
                    <Film className="h-4 w-4" />
                    <span className="hidden sm:inline">Project</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {postType !== 'project' && (
                <>
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
                  
                  {/* Image Upload Section */}
                  {imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden max-h-48">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setImageUrl('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <ImageUploader
                      userId={user.id}
                      onImageUploaded={setImageUrl}
                      compact
                    />
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
                </>
              )}

              {postType === 'project' && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Create a project to collaborate with your team
                  </p>
                  <Button onClick={() => setShowProjectWizard(true)}>
                    <Film className="h-4 w-4 mr-2" />
                    Start Project Wizard
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Wizard Dialog */}
      <Dialog open={showProjectWizard} onOpenChange={setShowProjectWizard}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a Project</DialogTitle>
          </DialogHeader>
          <ProjectWizard onClose={handleProjectWizardClose} />
        </DialogContent>
      </Dialog>
    </>
  );
};
