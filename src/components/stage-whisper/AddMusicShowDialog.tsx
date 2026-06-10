import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2, ImagePlus, X, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AddMusicShowDialogProps {
  trigger?: React.ReactNode;
  showType?: 'concert' | 'cabaret';
}

export const AddMusicShowDialog: React.FC<AddMusicShowDialogProps> = ({ trigger, showType = 'concert' }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [showDate, setShowDate] = useState<Date | undefined>(undefined);
  const [ticketUrl, setTicketUrl] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVenue('');
    setShowDate(undefined);
    setTicketUrl('');
    setIsFree(false);
    setIsAnonymous(false);
    setPosterFile(null);
    setPosterPreview(null);
  };

  const handlePosterSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setPosterFile(file);
    const reader = new FileReader();
    reader.onload = () => setPosterPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePoster = () => {
    setPosterFile(null);
    setPosterPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (authError || !authUser) throw new Error('You must be logged in');
      if (!title.trim()) throw new Error('Title is required');
      if (!posterFile) throw new Error('An image is required');
      if (!isFree && !ticketUrl.trim()) throw new Error('Please provide a ticket link or mark as free');

      const musicShowId = crypto.randomUUID();
      const fileExt = posterFile.name.split('.').pop() || 'jpg';
      const fileName = `${authUser.id}/music-shows/${musicShowId}/poster-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, posterFile, { upsert: true, contentType: posterFile.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('user_music_shows')
        .insert({
          id: musicShowId,
          title: title.trim(),
          description: description.trim() || null,
          venue: venue.trim() || null,
          show_date: showDate ? showDate.toISOString() : null,
          ticket_url: isFree ? null : ticketUrl.trim(),
          is_free: isFree,
          poster_url: urlData.publicUrl,
          submitted_by: authUser.id,
          is_anonymous: isAnonymous,
          is_active: true,
          show_type: showType,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Your show has been added! 🎵');
      queryClient.invalidateQueries({ queryKey: ['user-music-shows'] });
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit show');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Show</Button>}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in Required</DialogTitle>
            <DialogDescription>You need to be signed in to add a show.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Show</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Your Music Show</DialogTitle>
          <DialogDescription>Let your community know about your upcoming performance</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Poster */}
          <div className="space-y-2">
            <Label>Show Image / Flyer *</Label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePosterSelect} className="hidden" />
            {posterPreview ? (
              <div className="relative w-full aspect-[2/3] max-w-[200px] rounded-lg overflow-hidden border border-border">
                <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
                <button type="button" onClick={removePoster} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-[2/3] max-w-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm">Add show flyer</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="music-title">Show Title *</Label>
            <Input id="music-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Show or event name" maxLength={100} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="music-venue">Venue</Label>
            <Input id="music-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Where is the show?" maxLength={200} />
          </div>

          {/* Show Date */}
          <div className="space-y-2">
            <Label>Show Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !showDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {showDate ? format(showDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={showDate} onSelect={setShowDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Ticket / Free */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="music-free" checked={isFree} onCheckedChange={(v) => setIsFree(v === true)} />
              <Label htmlFor="music-free" className="text-sm">This is a free show</Label>
            </div>
            {!isFree && (
              <div className="space-y-2">
                <Label htmlFor="music-ticket">Ticket Link *</Label>
                <Input id="music-ticket" type="url" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="https://..." maxLength={500} required={!isFree} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="music-desc">Description</Label>
            <Textarea id="music-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell people about the show..." maxLength={500} rows={3} />
          </div>

          {/* Anonymous */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <EyeOff className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <Label htmlFor="music-anon" className="text-sm font-medium">Post Anonymously</Label>
              <p className="text-xs text-muted-foreground">Your name won't be shown</p>
            </div>
            <Switch id="music-anon" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitMutation.isPending} className="gap-2">
              {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Show
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
