import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
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

interface AddShowDialogProps {
  trigger?: React.ReactNode;
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

export const AddShowDialog: React.FC<AddShowDialogProps> = ({ trigger }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
  };

  const submitShowMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in to submit a show');
      if (!title.trim()) throw new Error('Title is required');
      if (!venue.trim()) throw new Error('Venue is required');

      const { error } = await supabase.from('nyc_shows').insert({
        title: title.trim(),
        venue: venue.trim(),
        borough,
        description: description.trim() || null,
        show_type: showType,
        category: 'off-off-broadway',
        price_tier: priceTier,
        run_start: runStart ? format(runStart, 'yyyy-MM-dd') : null,
        run_end: runEnd ? format(runEnd, 'yyyy-MM-dd') : null,
        show_times: showTimes.trim() || null,
        official_url: officialUrl.trim() || null,
        rush_policy: rushPolicy.trim() || null,
        submitted_by: user.id,
        is_active: true,
      });

      if (error) throw error;
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
          <DialogTitle>Add Your Off-Off-Broadway Show</DialogTitle>
          <DialogDescription>
            Share your performance with the NYC theatre community
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
              id="rushPolicy"
              value={rushPolicy}
              onChange={(e) => setRushPolicy(e.target.value)}
              placeholder="e.g., PWYC Thursdays, Student rush $15"
              maxLength={200}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={submitShowMutation.isPending}
          >
            {submitShowMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
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
