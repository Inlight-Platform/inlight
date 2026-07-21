import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, X, Calendar, Briefcase, MessageSquare, MapPin, Clock, Film, Link, Move, DollarSign, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { ImageUploader, ImageUploaderHandle } from './ImageUploader';
import { AudienceSelector, PostVisibility } from './AudienceSelector';
import { ImagePositioner } from '@/components/profile/ImagePositioner';
import { useMyGroups } from '@/hooks/useGroups';
import { SERVICE_CATEGORIES } from '@/data/services';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
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
  const [imagePositions, setImagePositions] = useState<{x: number; y: number}[]>([]);

  // Composer carousel state
  const [composerEmblaRef, composerEmblaApi] = useEmblaCarousel({ loop: false });
  const [composerIndex, setComposerIndex] = useState(0);
  const [composerCanPrev, setComposerCanPrev] = useState(false);
  const [composerCanNext, setComposerCanNext] = useState(false);
  const onComposerSelect = useCallback(() => {
    if (!composerEmblaApi) return;
    setComposerIndex(composerEmblaApi.selectedScrollSnap());
    setComposerCanPrev(composerEmblaApi.canScrollPrev());
    setComposerCanNext(composerEmblaApi.canScrollNext());
  }, [composerEmblaApi]);
  useEffect(() => {
    if (!composerEmblaApi) return;
    onComposerSelect();
    composerEmblaApi.on('select', onComposerSelect);
    composerEmblaApi.on('reInit', onComposerSelect);
    return () => { composerEmblaApi.off('select', onComposerSelect); };
  }, [composerEmblaApi, onComposerSelect]);
  const [isPaid, setIsPaid] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('');
  const [serviceCategory, setServiceCategory] = useState<string>('');

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
    setImageUrls([]);
    setLocation('');
    setEventDate('');
    setEventType('');
    setLinkUrl('');
    setLinkTitle('');
    setCustomQuestion('');
    setPostType('update');
    setVisibility('public');
    setSelectedRecipients([]);
    setImagePositions([]);
    setIsPaid(false);
    setTicketPrice('');
    setServiceCategory('');
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      
      if (postType === 'update') {
        const categoryLabel = SERVICE_CATEGORIES.find((c) => c.slug === serviceCategory)?.label;
        const prefixedContent = categoryLabel
          ? `[${categoryLabel}] ${content.trim()}`
          : content.trim();
        const { data: postData, error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: prefixedContent,
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            image_position_x: imagePositions[0]?.x ?? 50,
            image_position_y: imagePositions[0]?.y ?? 50,
            link_url: linkUrl.trim() || null,
            link_title: linkTitle.trim() || null,
            visibility,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Also tag the user's profile with the chosen service so they appear
        // in the Services discovery tab.
        if (serviceCategory) {
          const categoryLabel = SERVICE_CATEGORIES.find((c) => c.slug === serviceCategory)?.label;
          if (categoryLabel) {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('skills')
              .eq('user_id', user.id)
              .maybeSingle();
            const existing = (profileRow?.skills as string[] | null) || [];
            if (!existing.some((s) => s.toLowerCase() === categoryLabel.toLowerCase())) {
              await supabase
                .from('profiles')
                .update({ skills: [...existing, categoryLabel] })
                .eq('user_id', user.id);
            }
          }
        }
        
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
            image_url: imageUrls[0] || null,
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
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            image_position_x: imagePositions[0]?.x ?? 50,
            image_position_y: imagePositions[0]?.y ?? 50,
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

        // Tag to a group for group visibility
        if (visibility === 'group' && selectedGroupId && jobData) {
          const { error: gErr } = await (supabase.from as any)('post_groups')
            .insert({ post_id: jobData.id, group_id: selectedGroupId });
          if (gErr) console.error('Failed to tag post group:', gErr);
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
    if (postType === 'event' && (!title.trim() || !eventDate || imageUrls.length === 0)) {
      if (imageUrls.length === 0) toast.error('Please add an image for your event');
      else toast.error('Please fill in the event title and date');
      return;
    }
    if (postType === 'job' && (!title.trim() || !content.trim() || imageUrls.length === 0)) {
      if (imageUrls.length === 0) toast.error('Please add an image for your opportunity');
      return;
    }
    console.log('Creating post/event...');
    createPostMutation.mutate();
  };

  const isValid = () => {
    if (visibility === 'specific' && selectedRecipients.length === 0 && (postType === 'update' || postType === 'job')) return false;
    if (postType === 'update') return content.trim().length > 0;
    if (postType === 'event') return title.trim().length > 0 && eventDate.length > 0 && imageUrls.length > 0;
    if (postType === 'job') return title.trim().length > 0 && content.trim().length > 0 && imageUrls.length > 0;
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
                  {postType === 'update' && (
                    <div className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">
                        Service category (optional)
                      </label>
                      <Select value={serviceCategory} onValueChange={setServiceCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a service you're offering..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {SERVICE_CATEGORIES.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.emoji}  {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Picking a category lists you under that service for people to discover.
                      </p>
                    </div>
                  )}

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
                  
                  {/* Image carousel preview with per-image crop + delete */}
                  {imageUrls.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="relative rounded-lg overflow-hidden">
                        <div ref={composerEmblaRef} className="overflow-hidden">
                          <div className="flex">
                            {imageUrls.map((url, idx) => {
                              const pos = imagePositions[idx] ?? { x: 50, y: 50 };
                              return (
                                <div key={url} className="flex-none w-full relative">
                                  <img
                                    src={url}
                                    alt={`Image ${idx + 1}`}
                                    className="w-full h-64 object-cover"
                                    style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
                                  />
                                  {/* Per-image controls */}
                                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                                    <ImagePositioner
                                      imageUrl={url}
                                      initialPositionX={pos.x}
                                      initialPositionY={pos.y}
                                      aspectRatio={16 / 9}
                                      onSave={(x, y) => setImagePositions((prev) => {
                                        const next = [...prev];
                                        next[idx] = { x, y };
                                        return next;
                                      })}
                                      trigger={
                                        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background">
                                          <Move className="h-3.5 w-3.5" />
                                        </Button>
                                      }
                                    />
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setImageUrls((p) => p.filter((_, i) => i !== idx));
                                        setImagePositions((p) => p.filter((_, i) => i !== idx));
                                      }}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  {/* Slide counter */}
                                  <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                    {idx + 1} / {imageUrls.length}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {composerCanPrev && (
                          <button
                            type="button"
                            onClick={() => composerEmblaApi?.scrollPrev()}
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {composerCanNext && (
                          <button
                            type="button"
                            onClick={() => composerEmblaApi?.scrollNext()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dot indicators */}
                      {imageUrls.length > 1 && (
                        <div className="flex justify-center gap-1.5">
                          {imageUrls.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => composerEmblaApi?.scrollTo(i)}
                              className={`h-1.5 rounded-full transition-all duration-200 ${i === composerIndex ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40'}`}
                            />
                          ))}
                        </div>
                      )}

                      {imageUrls.length < 4 && (
                        <button
                          type="button"
                          onClick={() => imageUploaderRef.current?.trigger()}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add photo ({4 - imageUrls.length} remaining)
                        </button>
                      )}
                    </div>
                  )}

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
                      ref={imageUploaderRef}
                      userId={user.id}
                      onImageUploaded={(url) => {
                        setImageUrls((prev) => [...prev, url]);
                        setImagePositions((prev) => [...prev, { x: 50, y: 50 }]);
                      }}
                      compact
                      currentCount={imageUrls.length}
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
