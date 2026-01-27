import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, ImagePlus, X, Pencil, EyeOff } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TeammateSelector, Teammate } from './TeammateSelector';
import { Show } from './ShowCard';

interface EditShowDialogProps {
  show: Show;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const SHOW_TYPES = [
  { value: 'play', label: 'Play' },
  { value: 'musical', label: 'Musical' },
  { value: 'dance', label: 'Dance' },
  { value: 'opera', label: 'Opera' },
  { value: 'other', label: 'Other' },
];

const PRICE_TIERS = [
  { value: 'budget', label: '$ (Under $30)' },
  { value: 'moderate', label: '$$ ($30-$75)' },
  { value: 'premium', label: '$$$ ($75+)' },
];

const BOROUGHS = [
  { value: 'Manhattan', label: 'Manhattan' },
  { value: 'Brooklyn', label: 'Brooklyn' },
  { value: 'Queens', label: 'Queens' },
  { value: 'Bronx', label: 'Bronx' },
  { value: 'Staten Island', label: 'Staten Island' },
];

export const EditShowDialog: React.FC<EditShowDialogProps> = ({ show, trigger, onSuccess }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state - initialized from show
  const [title, setTitle] = useState(show.title);
  const [venue, setVenue] = useState(show.venue);
  const [borough, setBorough] = useState(show.borough);
  const [description, setDescription] = useState(show.description || '');
  const [showType, setShowType] = useState(show.show_type);
  const [priceTier, setPriceTier] = useState(show.price_tier);
  const [runStart, setRunStart] = useState<Date | undefined>(
    show.run_start ? new Date(show.run_start) : undefined
  );
  const [runEnd, setRunEnd] = useState<Date | undefined>(
    show.run_end ? new Date(show.run_end) : undefined
  );
  const [showTimes, setShowTimes] = useState(show.show_times || '');
  const [officialUrl, setOfficialUrl] = useState(show.official_url || '');
  const [rushPolicy, setRushPolicy] = useState(show.rush_policy || '');
  const [isAnonymous, setIsAnonymous] = useState((show as any).is_anonymous || false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);

  // Poster image state
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(show.poster_url || null);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Fetch existing teammates
  const { data: existingTeammates = [] } = useQuery({
    queryKey: ['show-teammates', show.id],
    queryFn: async () => {
      const { data: teammateData } = await supabase
        .from('show_teammates')
        .select('user_id, role_description')
        .eq('show_id', show.id);

      if (!teammateData || teammateData.length === 0) return [];

      // Fetch profiles for teammates
      const userIds = teammateData.map(t => t.user_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return teammateData.map(t => ({
        user_id: t.user_id,
        display_name: profileMap.get(t.user_id)?.display_name || null,
        avatar_url: profileMap.get(t.user_id)?.avatar_url || null,
        role_description: t.role_description || undefined,
      })) as Teammate[];
    },
    enabled: open,
  });

  // Reset form when show changes
  useEffect(() => {
    setTitle(show.title);
    setVenue(show.venue);
    setBorough(show.borough);
    setDescription(show.description || '');
    setShowType(show.show_type);
    setPriceTier(show.price_tier);
    setRunStart(show.run_start ? new Date(show.run_start) : undefined);
    setRunEnd(show.run_end ? new Date(show.run_end) : undefined);
    setShowTimes(show.show_times || '');
    setOfficialUrl(show.official_url || '');
    setRushPolicy(show.rush_policy || '');
    setIsAnonymous((show as any).is_anonymous || false);
    setPosterPreview(show.poster_url || null);
    setPosterFile(null);
  }, [show]);

  // Sync teammates when existingTeammates loads
  useEffect(() => {
    if (existingTeammates.length > 0) {
      setTeammates(existingTeammates);
    }
  }, [existingTeammates]);

  const handlePosterSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setPosterFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPosterPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePoster = () => {
    setPosterFile(null);
    setPosterPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPoster = async (): Promise<string | null> => {
    if (!posterFile || !user) return null;

    setUploadingPoster(true);
    try {
      const fileExt = posterFile.name.split('.').pop();
      const fileName = `shows/${show.id}/poster.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, posterFile, {
          upsert: true,
          contentType: posterFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Poster upload failed:', error);
      return null;
    } finally {
      setUploadingPoster(false);
    }
  };

  const updateShowMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in');
      if (!title.trim()) throw new Error('Title is required');
      if (!venue.trim()) throw new Error('Venue is required');

      let posterUrl = show.poster_url;

      // Upload new poster if selected
      if (posterFile) {
        const newPosterUrl = await uploadPoster();
        if (newPosterUrl) {
          posterUrl = newPosterUrl;
        }
      } else if (!posterPreview) {
        // Poster was removed
        posterUrl = null;
      }

      const { error } = await supabase
        .from('nyc_shows')
        .update({
          title: title.trim(),
          venue: venue.trim(),
          borough,
          description: description.trim() || null,
          show_type: showType,
          price_tier: priceTier,
          run_start: runStart ? format(runStart, 'yyyy-MM-dd') : null,
          run_end: runEnd ? format(runEnd, 'yyyy-MM-dd') : null,
          show_times: showTimes.trim() || null,
          official_url: officialUrl.trim() || null,
          rush_policy: rushPolicy.trim() || null,
          poster_url: posterUrl,
          is_anonymous: isAnonymous,
        })
        .eq('id', show.id);

      if (error) throw error;

      // Update teammates: delete existing and re-insert
      await supabase
        .from('show_teammates')
        .delete()
        .eq('show_id', show.id);

      if (teammates.length > 0) {
        const teammateRecords = teammates.map(t => ({
          show_id: show.id,
          user_id: t.user_id,
          role_description: t.role_description || null,
        }));

        await supabase
          .from('show_teammates')
          .insert(teammateRecords);
      }
    },
    onSuccess: () => {
      toast.success('Show updated! 🎭');
      queryClient.invalidateQueries({ queryKey: ['nyc-shows'] });
      queryClient.invalidateQueries({ queryKey: ['show-teammates', show.id] });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update show');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateShowMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Show</DialogTitle>
          <DialogDescription>
            Update your show's details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Poster Image Upload */}
          <div className="space-y-2">
            <Label>Show Poster</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePosterSelect}
              className="hidden"
            />

            {posterPreview ? (
              <div className="relative w-full aspect-[2/3] max-w-[200px] rounded-lg overflow-hidden border border-border">
                <img
                  src={posterPreview}
                  alt="Poster preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removePoster}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[2/3] max-w-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm">Add poster image</span>
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Recommended: 2:3 aspect ratio (like a playbill)
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Show Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter show title"
              maxLength={100}
              required
            />
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="edit-venue">Venue *</Label>
            <Input
              id="edit-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Theatre or venue name"
              maxLength={100}
              required
            />
          </div>

          {/* Borough */}
          <div className="space-y-2">
            <Label>Borough</Label>
            <Select value={borough} onValueChange={setBorough}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOROUGHS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your show"
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Show Type & Price Tier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Show Type</Label>
              <Select value={showType} onValueChange={setShowType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHOW_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price Tier</Label>
              <Select value={priceTier} onValueChange={setPriceTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_TIERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Run Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Run Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !runStart && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {runStart ? format(runStart, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={runStart}
                    onSelect={setRunStart}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Run End</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !runEnd && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {runEnd ? format(runEnd, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={runEnd}
                    onSelect={setRunEnd}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Show Times */}
          <div className="space-y-2">
            <Label htmlFor="edit-showTimes">Show Times</Label>
            <Input
              id="edit-showTimes"
              value={showTimes}
              onChange={(e) => setShowTimes(e.target.value)}
              placeholder="e.g., Thu-Sat 8pm, Sun 3pm"
              maxLength={200}
            />
          </div>

          {/* Ticket Link */}
          <div className="space-y-2">
            <Label htmlFor="edit-officialUrl">Ticket Link</Label>
            <Input
              id="edit-officialUrl"
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </div>

          {/* Rush Policy */}
          <div className="space-y-2">
            <Label htmlFor="edit-rushPolicy">Rush/Discount Policy</Label>
            <Input
              id="edit-rushPolicy"
              value={rushPolicy}
              onChange={(e) => setRushPolicy(e.target.value)}
              placeholder="e.g., PWYC Thursdays, Student rush $15"
              maxLength={200}
            />
          </div>

          {/* Teammates */}
          <div className="space-y-2">
            <Label>Teammates</Label>
            <TeammateSelector
              teammates={teammates}
              onChange={setTeammates}
              excludeUserIds={user ? [user.id] : []}
              placeholder="Search to add cast & crew..."
            />
          </div>

          {/* Anonymous Posting */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="edit-anonymous-toggle" className="text-sm font-medium flex items-center gap-2">
                <EyeOff className="w-4 h-4" />
                Post Anonymously
              </Label>
              <p className="text-xs text-muted-foreground">
                Your name won't be shown as the submitter
              </p>
            </div>
            <Switch
              id="edit-anonymous-toggle"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={updateShowMutation.isPending || uploadingPoster}
          >
            {updateShowMutation.isPending || uploadingPoster ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingPoster ? 'Uploading image...' : 'Saving...'}
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditShowDialog;
