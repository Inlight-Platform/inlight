import React, { useRef, useState } from 'react';
import { Briefcase, ImagePlus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useOpportunities } from '@/hooks/useOpportunities';
import { ProjectImageCropper } from '@/components/projects/ProjectImageCropper';
import { supabase } from '@/integrations/supabase/client';
import { createOpportunityDateTimeIso } from '@/lib/opportunityCalendar';
import { toast } from 'sonner';

interface OpportunityCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician' | 'Gaffer' | 'Grip' | 'DP' | 'AD' | 'Extras' | 'Singer' | 'Dancer' | 'Designer' | 'Technical';

const OpportunityCreator: React.FC<OpportunityCreatorProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { createOpportunity } = useOpportunities();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('job');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('any');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [actionType, setActionType] = useState('apply');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalLabel, setExternalLabel] = useState('Apply Externally');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const allRoles: UserRole[] = ['Actor', 'Director', 'Producer', 'Musician', 'Gaffer', 'Grip', 'DP', 'AD', 'Extras', 'Singer', 'Dancer', 'Designer', 'Technical'];

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropperSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageCropComplete = async (blob: Blob) => {
    if (!user) return;
    setImageUploading(true);
    try {
      const fileName = `${user.id}/opportunities/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profile-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return;
    
    if (!user) {
      toast.error('You must be logged in to post an opportunity');
      return;
    }

    const isExternal = actionType === 'external';
    if (isExternal && !externalUrl.trim()) {
      toast.error('Please provide an External URL');
      return;
    }

    // For in-person events, combine date + times into ISO datetimes
    const isCalendar = actionType === 'calendar';
    const startIso = isCalendar
      ? createOpportunityDateTimeIso(deadlineDate, startTime)
      : undefined;
    const endIso = isCalendar
      ? createOpportunityDateTimeIso(deadlineDate, endTime)
      : undefined;
    const endOfDayIso = isCalendar
      ? createOpportunityDateTimeIso(deadlineDate, '23:59')
      : undefined;

    createOpportunity.mutate({
      title: title.trim(),
      description: description.trim(),
      type,
      status: 'open',
      company: company.trim() || undefined,
      location: location.trim() || 'Remote',
      is_remote: isRemote,
      compensation: compensation.trim() || undefined,
      experience_level: experienceLevel,
      roles: selectedRoles,
      skills: [],
      requirements: [],
      deadline: isCalendar ? (endIso || startIso || endOfDayIso) : (deadlineDate || undefined),
      start_date: isCalendar ? startIso : undefined,
      duration: duration.trim() || undefined,
      tags: [],
      is_featured: false,
      action_type: actionType,
      image_url: imageUrl || undefined,
      link_url: isExternal ? externalUrl.trim() : (linkUrl.trim() || undefined),
      link_title: isExternal ? (externalLabel.trim() || 'Apply Externally') : (linkTitle.trim() || undefined),
    }, {
      onSuccess: () => {
        setTitle('');
        setDescription('');
        setType('job');
        setCompany('');
        setLocation('');
        setIsRemote(false);
        setCompensation('');
        setExperienceLevel('any');
        setSelectedRoles([]);
        setDeadlineDate('');
        setStartTime('');
        setEndTime('');
        setDuration('');
        setActionType('apply');
        setImageUrl('');
        setLinkUrl('');
        setLinkTitle('');
        setExternalUrl('');
        setExternalLabel('Apply Externally');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[hsl(var(--neon-opportunities))]" />
            Post an Opportunity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Lead Actor for Feature Film"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="type">Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="casting">Casting Call</SelectItem>
                    <SelectItem value="gig">Gig</SelectItem>
                    <SelectItem value="collaboration">Collaboration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="company">Company / Production</Label>
                <Input
                  id="company"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the opportunity, requirements, and what you're looking for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>

          {/* Location & Compensation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Los Angeles, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1"
                disabled={isRemote}
              />
            </div>

            <div>
              <Label htmlFor="compensation">Compensation</Label>
              <Input
                id="compensation"
                placeholder="e.g., $500/day, Deferred, Union Scale"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="remote"
                checked={isRemote}
                onCheckedChange={setIsRemote}
              />
              <Label htmlFor="remote">Remote opportunity</Label>
            </div>
          </div>

          {/* Experience & Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="experience">Experience Level</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="any">Any Level</SelectItem>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="senior">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="deadline">Date</Label>
              <Input
                id="deadline"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g., 3 months, 2 weeks"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="actionType">Response Type</Label>
              <Select value={actionType} onValueChange={(v) => {
                setActionType(v);
                if (v !== 'external') {
                  setExternalUrl('');
                  setExternalLabel('Apply Externally');
                }
              }}>
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="apply">Inlight Application</SelectItem>
                  <SelectItem value="external">External Application</SelectItem>
                  <SelectItem value="calendar">In-Person (Add to Calendar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* External Application fields */}
          {actionType === 'external' && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="col-span-2">
                <Label htmlFor="externalUrl">External URL *</Label>
                <Input
                  id="externalUrl"
                  type="url"
                  placeholder="https://..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="externalLabel">Button Label</Label>
                <Input
                  id="externalLabel"
                  placeholder="Apply on Casting Networks"
                  value={externalLabel}
                  onChange={(e) => setExternalLabel(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* In-Person time fields */}
          {actionType === 'calendar' && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="col-span-2 text-sm text-muted-foreground">
                Add a start and end time so attendees can save the event to their calendar with the correct time.
              </div>
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Roles Needed */}
          <div>
            <Label>Roles Needed</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {allRoles.map((role) => (
                <Badge
                  key={role}
                  variant={selectedRoles.includes(role) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleRole(role)}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          {/* Image */}
          {user && (
            <div>
              <Label>Image (optional)</Label>
              <div className="mt-2">
                {imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={imageUrl} alt="Preview" className="w-full aspect-[4/3] object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => setImageUrl('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-sm">{imageUploading ? 'Uploading…' : 'Add image'}</span>
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={handleImageFileSelect}
                />
                <ProjectImageCropper
                  open={cropperOpen}
                  onClose={() => { setCropperOpen(false); setCropperSrc(''); }}
                  imageSrc={cropperSrc}
                  onCropComplete={handleImageCropComplete}
                  title="Crop image"
                  aspect={4 / 3}
                  outputWidth={1200}
                  outputHeight={900}
                />
              </div>
            </div>
          )}

          {/* Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkUrl">Link URL (optional)</Label>
              <Input
                id="linkUrl"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="linkTitle">Link Button Label</Label>
              <Input
                id="linkTitle"
                placeholder="e.g., Visit Website"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || createOpportunity.isPending}
              className="bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
            >
              {createOpportunity.isPending ? 'Posting...' : 'Post Opportunity'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityCreator;
