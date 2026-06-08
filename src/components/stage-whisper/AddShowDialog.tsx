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

interface AddShowDialogProps {
  trigger?: React.ReactNode;
  category?: 'off-off-broadway' | 'school';
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

export const AddShowDialog: React.FC<AddShowDialogProps> = ({ trigger, category = 'off-off-broadway' }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [borough, setBorough] = useState('Manhattan');
  const [description, setDescription] = useState('');
  const [showType, setShowType] = useState('play');
  const [priceTier, setPriceTier] = useState('moderate');
  const [runStart, setRunStart] = useState<Date | undefined>(undefined);
  const [runEnd, setRunEnd] = useState<Date | undefined>(undefined);
  const [showTimes, setShowTimes] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [rushPolicy, setRushPolicy] = useState('');
  
  // Anonymity and teammates
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  
  // Poster image state
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const resetForm = () => {
    setTitle('');
    setVenue('');
    setBorough('Manhattan');
    setDescription('');
    setShowType('play');
    setPriceTier('moderate');
    setRunStart(undefined);
    setRunEnd(undefined);
    setShowTimes('');
    setOfficialUrl('');
    setRushPolicy('');
    setIsAnonymous(false);
    setTeammates([]);
    setPosterFile(null);
    setPosterPreview(null);
  };

  const handlePosterSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    
    setPosterFile(file);
    
    // Create preview
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

  const uploadPoster = async (showId: string): Promise<string | null> => {
    if (!posterFile || !user) return null;
    
    setUploadingPoster(true);
    try {
      const fileExt = posterFile.name.split('.').pop();
      const fileName = `shows/${showId}/poster.${fileExt}`;
      
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
      toast.error('Poster upload failed: ' + (error?.message || 'Unknown error'));
      return null;
    } finally {
      setUploadingPoster(false);
    }
  };

  const submitShowMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in to submit a show');
      if (!title.trim()) throw new Error('Title is required');
      if (!venue.trim()) throw new Error('Venue is required');
      if (!posterFile) throw new Error('A show poster image is required');

      // First insert the show to get its ID
      const { data: showData, error: insertError } = await supabase
        .from('nyc_shows')
        .insert({
          title: title.trim(),
          venue: venue.trim(),
          borough,
          description: description.trim() || null,
          show_type: showType,
          category: category,
          price_tier: priceTier,
          run_start: runStart ? format(runStart, 'yyyy-MM-dd') : null,
          run_end: runEnd ? format(runEnd, 'yyyy-MM-dd') : null,
          show_times: showTimes.trim() || null,
          official_url: officialUrl.trim() || null,
          rush_policy: rushPolicy.trim() || null,
          submitted_by: user.id,
          is_active: true,
          is_anonymous: isAnonymous,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      
      // Upload poster if provided
      if (posterFile && showData?.id) {
        const posterUrl = await uploadPoster(showData.id);
        if (!posterUrl) throw new Error('Failed to upload poster image');
        await supabase
          .from('nyc_shows')
          .update({ poster_url: posterUrl })
          .eq('id', showData.id);
      }

      // Add teammates if any
      if (teammates.length > 0 && showData?.id) {
        const teammateRecords = teammates.map(t => ({
          show_id: showData.id,
          user_id: t.user_id,
          role_description: t.role_description || null,
        }));

        await supabase
          .from('show_teammates')
          .insert(teammateRecords);
      }
    },
    onSuccess: () => {
      toast.success('Your show has been added! 🎭');
      queryClient.invalidateQueries({ queryKey: ['nyc-shows'] });
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit show');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitShowMutation.mutate();
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Your Show
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in Required</DialogTitle>
            <DialogDescription>
              You need to be signed in to add your show. Please sign in first.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Your Show
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Add Your {category === 'school' ? 'School' : 'Off-Off-Broadway'} Show
          </DialogTitle>
          <DialogDescription>
            Share your performance with the NYC theatre community
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
            <Label htmlFor="title">Show Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter show title"
              maxLength={100}
              required
            />
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venue">Venue *</Label>
            <Input
              id="venue"
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
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
            <Label htmlFor="showTimes">Show Times</Label>
            <Input
              id="showTimes"
              value={showTimes}
              onChange={(e) => setShowTimes(e.target.value)}
              placeholder="e.g., Thu-Sat 8pm, Sun 3pm"
              maxLength={200}
            />
          </div>

          {/* Ticket Link */}
          <div className="space-y-2">
            <Label htmlFor="officialUrl">Ticket Link</Label>
            <Input
              id="officialUrl"
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </div>

          {/* Rush Policy */}
          <div className="space-y-2">
            <Label htmlFor="rushPolicy">Rush/Discount Policy</Label>
            <Input
              id="rushPolicy-add"
              value={rushPolicy}
              onChange={(e) => setRushPolicy(e.target.value)}
              placeholder="e.g., PWYC Thursdays, Student rush $15"
              maxLength={200}
            />
          </div>

          {/* Teammates */}
          <div className="space-y-2">
            <Label>Teammates (Optional)</Label>
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
              <Label htmlFor="anonymous-toggle" className="text-sm font-medium flex items-center gap-2">
                <EyeOff className="w-4 h-4" />
                Post Anonymously
              </Label>
              <p className="text-xs text-muted-foreground">
                Your name won't be shown as the submitter
              </p>
            </div>
            <Switch
              id="anonymous-toggle"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={submitShowMutation.isPending || uploadingPoster}
          >
            {submitShowMutation.isPending || uploadingPoster ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingPoster ? 'Uploading image...' : 'Submitting...'}
              </>
            ) : (
              'Add Show'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddShowDialog;
