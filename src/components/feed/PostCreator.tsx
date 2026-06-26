import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, X, Calendar, Briefcase, MessageSquare, MapPin, Clock, Film, Link, Move, DollarSign } from 'lucide-react';
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
import { ImageUploader } from './ImageUploader';
import { AudienceSelector, PostVisibility } from './AudienceSelector';
import { ImagePositioner } from '@/components/profile/ImagePositioner';
import { useMyGroups } from '@/hooks/useGroups';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [postType, setPostType] = useState<PostType>(defaultPostType);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [selectedRecipients, setSelectedRecipients] = useState<{ user_id: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { data: myGroups = [] } = useMyGroups();
  const [linkTitle, setLinkTitle] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [isPaid, setIsPaid] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('');

  // Update postType when defaultPostType changes (for when dialog reopens with different type)
  useEffect(() => {
    setPostType(defaultPostType);
    if (defaultPostType === 'project') {
      navigate('/projects/new');
      onClose?.();
    }
  }, [defaultPostType]);

  const resetForm = () => {
    setContent('');
    setTitle('');
    setImageUrl('');
    setLocation('');
    setEventDate('');
    setEventType('');
    setLinkUrl('');
    setLinkTitle('');
    setCustomQuestion('');
    setPostType('update');
    setVisibility('public');
    setSelectedRecipients([]);
    setPositionX(50);
    setPositionY(50);
    setIsPaid(false);
    setTicketPrice('');
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      
      if (postType === 'update') {
        const { data: postData, error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: content.trim(),
            image_url: imageUrl || null,
            image_position_x: positionX,
            image_position_y: positionY,
            link_url: linkUrl.trim() || null,
            link_title: linkTitle.trim() || null,
            visibility,
          })
          .select('id')
          .single();
        if (error) throw error;
        
        // Insert recipients for specific visibility
        if (visibility === 'specific' && selectedRecipients.length > 0 && postData) {
          const { error: recError } = await supabase
            .from('post_recipients')
            .insert(
              selectedRecipients.map((r) => ({
                post_id: postData.id,
                recipient_id: r.user_id,
              }))
            );
          if (recError) console.error('Failed to add recipients:', recError);
        }

        // Tag to a group for group visibility
        if (visibility === 'group' && selectedGroupId && postData) {
          const { error: gErr } = await (supabase.from as any)('post_groups')
            .insert({ post_id: postData.id, group_id: selectedGroupId });
          if (gErr) console.error('Failed to tag post group:', gErr);
        }
      } else if (postType === 'event') {
        // Convert datetime-local to ISO format for Supabase
        const eventDateValue = eventDate ? new Date(eventDate).toISOString() : null;
        
        if (!eventDateValue) {
          throw new Error('Event date is required');
        }
        
        const parsedPrice = isPaid && ticketPrice ? parseFloat(ticketPrice) : null;
        const defaultPaymentLink = isPaid && parsedPrice === 10
          ? 'https://buy.stripe.com/5kQcN4fsA37B9Br4yjco001'
          : null;

        const { data: eventData, error } = await supabase
          .from('events')
          .insert({
            user_id: user.id,
            title: title.trim(),
            description: content.trim() || null,
            event_date: eventDateValue,
            location: location.trim() || null,
            event_type: eventType.trim() || 'general',
            image_url: imageUrl || null,
            link_url: linkUrl.trim() || null,
            link_title: linkTitle.trim() || null,
            custom_question: customQuestion.trim() || null,
            is_paid: isPaid,
            price: parsedPrice,
            currency: 'usd',
            payment_link_url: defaultPaymentLink,
          })
          .select('id')
          .single();
        if (error) {
          console.error('Event creation error:', error);
          throw error;
        }

        // If paid event, create Stripe price
        if (isPaid && ticketPrice && eventData) {
          const { error: priceError } = await supabase.functions.invoke('create-event-price', {
            body: {
              event_id: eventData.id,
              title: title.trim(),
              price: parseFloat(ticketPrice),
              currency: 'usd',
            },
          });
          if (priceError) {
            console.error('Stripe price creation error:', priceError);
            // Non-fatal: event is created, price can be retried
          }
        }
      } else if (postType === 'job') {
        // Jobs are stored as posts with a special format and optional link
        const { data: jobData, error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: `🎯 **${title.trim()}**\n\n${content.trim()}${location ? `\n\n📍 ${location}` : ''}`,
            image_url: imageUrl || null,
            image_position_x: positionX,
            image_position_y: positionY,
            link_url: linkUrl.trim() || null,
            link_title: linkTitle.trim() || null,
            visibility,
          })
          .select('id')
          .single();
        if (error) throw error;
        
        // Insert recipients for specific visibility
        if (visibility === 'specific' && selectedRecipients.length > 0 && jobData) {
          const { error: recError } = await supabase
            .from('post_recipients')
            .insert(
              selectedRecipients.map((r) => ({
                post_id: jobData.id,
                recipient_id: r.user_id,
              }))
            );
          if (recError) console.error('Failed to add recipients:', recError);
        }
      }
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed-events'] });
      toast.success(
        postType === 'update' ? 'Post created!' : 
        postType === 'event' ? 'Event created!' : 
        'Opportunity posted!'
      );
      onClose?.();
    },
    onError: (error: Error) => {
      console.error('Post creation failed:', error);
      toast.error(error.message || 'Failed to create post');
    },
  });

  const handleSubmit = () => {
    console.log('handleSubmit called', { postType, title, eventDate, content });
    if (postType === 'update' && !content.trim()) {
      console.log('Update validation failed');
      return;
    }
    if (postType === 'event' && (!title.trim() || !eventDate || !imageUrl)) {
      console.log('Event validation failed', { title: title.trim(), eventDate, imageUrl });
      if (!imageUrl) toast.error('Please add an image for your event');
      else toast.error('Please fill in the event title and date');
      return;
    }
    if (postType === 'job' && (!title.trim() || !content.trim() || !imageUrl)) {
      console.log('Job validation failed');
      if (!imageUrl) toast.error('Please add an image for your opportunity');
      return;
    }
    console.log('Creating post/event...');
    createPostMutation.mutate();
  };

  const isValid = () => {
    if (visibility === 'specific' && selectedRecipients.length === 0 && (postType === 'update' || postType === 'job')) return false;
    if (postType === 'update') return content.trim().length > 0;
    if (postType === 'event') return title.trim().length > 0 && eventDate.length > 0 && imageUrl.length > 0;
    if (postType === 'job') return title.trim().length > 0 && content.trim().length > 0 && imageUrl.length > 0;
    return false;
  };

  const handlePostTypeChange = (value: string) => {
    const newType = value as PostType;
    setPostType(newType);
    if (newType === 'project') {
      navigate('/projects/new');
      onClose?.();
    }
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
                    <span className="hidden sm:inline">Service</span>
                  </TabsTrigger>
                  <TabsTrigger value="event" className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Event</span>
                  </TabsTrigger>
                  <TabsTrigger value="job" className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span className="hidden sm:inline">Opportunity</span>
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
                    <div className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">
                        {postType === 'event' ? 'Event title' : 'Opportunity title'} <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder={postType === 'event' ? 'Event title...' : 'Opportunity title...'}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {/* Content textarea */}
                  <Textarea
                    placeholder={
                      postType === 'update' ? "Share a skill or service you offer..." :
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
                          Date & Time <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="datetime-local"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          required
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
                    <div className="space-y-3">
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
                      <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                        <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Link className="h-3.5 w-3.5" />
                          Application link (optional)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="Link title (e.g. Apply here)"
                            value={linkTitle}
                            onChange={(e) => setLinkTitle(e.target.value)}
                          />
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Event type and paid toggle for events */}
                  {postType === 'event' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">Event Type</label>
                        <Input
                          placeholder="Workshop, Networking, Performance..."
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value)}
                        />
                      </div>

                      {/* Paid event toggle */}
                      <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5" />
                            Paid Event
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsPaid(!isPaid)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        {isPaid && (
                          <div className="space-y-1.5">
                            <label className="text-sm text-muted-foreground">Ticket Price (USD) <span className="text-destructive">*</span></label>
                            <Input
                              type="number"
                              min="0.50"
                              step="0.01"
                              placeholder="10.00"
                              value={ticketPrice}
                              onChange={(e) => setTicketPrice(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">Custom RSVP Question (optional)</label>
                        <Input
                          placeholder="e.g. What scene will you be performing?"
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          maxLength={200}
                        />
                        <p className="text-xs text-muted-foreground">This question will appear on the RSVP form</p>
                      </div>
                    </>
                  )}

                  {/* Link fields for updates and events */}
                  {(postType === 'update' || postType === 'event') && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Link className="h-3.5 w-3.5" />
                        Add a link (optional)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Link title (e.g. RSVP here)"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                        />
                        <Input
                          type="url"
                          placeholder="https://..."
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Image Upload Section */}
                  {imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden max-h-48">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${positionX}% ${positionY}%` }}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <ImagePositioner
                          imageUrl={imageUrl}
                          initialPositionX={positionX}
                          initialPositionY={positionY}
                          aspectRatio={16 / 9}
                          onSave={(x, y) => {
                            setPositionX(x);
                            setPositionY(y);
                          }}
                          trigger={
                            <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background">
                              <Move className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setImageUrl('');
                            setPositionX(50);
                            setPositionY(50);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* Validation helper */}
                  {postType === 'event' && !isValid() && (title.trim() || eventDate) && (
                    <p className="text-sm text-amber-500">
                      {!title.trim() && !eventDate 
                        ? 'Please add a title and date' 
                        : !title.trim() 
                          ? 'Please add an event title' 
                          : 'Please select a date and time'}
                    </p>
                  )}

                  {/* Audience Selector for posts and jobs */}
                  {(postType === 'update' || postType === 'job') && (
                    <AudienceSelector
                      visibility={visibility}
                      onVisibilityChange={setVisibility}
                      selectedUsers={selectedRecipients}
                      onSelectedUsersChange={setSelectedRecipients}
                      currentUserId={user.id}
                      availableGroups={myGroups.map((g) => ({ id: g.id, name: g.name }))}
                      selectedGroupId={selectedGroupId}
                      onSelectedGroupChange={setSelectedGroupId}
                    />
                  )}

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
                        className={!isValid() ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {createPostMutation.isPending 
                          ? 'Creating...' 
                          : postType === 'update' 
                            ? 'Post' 
                            : postType === 'event' 
                              ? 'Create Event' 
                              : 'Post Opportunity'}
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
                  <Button onClick={() => { navigate('/projects/new'); onClose?.(); }}>
                    <Film className="h-4 w-4 mr-2" />
                    Create New Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
