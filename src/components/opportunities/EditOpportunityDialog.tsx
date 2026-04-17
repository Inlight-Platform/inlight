import React, { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
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
import { useOpportunities, OpportunityView } from '@/hooks/useOpportunities';
import { ImageUploader } from '@/components/feed/ImageUploader';
import { useAuth } from '@/hooks/useAuth';

interface EditOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: OpportunityView;
}

type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician' | 'Gaffer' | 'Grip' | 'DP' | 'AD' | 'Extras' | 'Singer' | 'Dancer' | 'Designer';
const allRoles: UserRole[] = ['Actor', 'Director', 'Producer', 'Musician', 'Gaffer', 'Grip', 'DP', 'AD', 'Extras', 'Singer', 'Dancer', 'Designer'];

const EditOpportunityDialog: React.FC<EditOpportunityDialogProps> = ({ open, onOpenChange, opportunity }) => {
  const { updateOpportunity } = useOpportunities();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('job');
  const [status, setStatus] = useState('open');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('any');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [duration, setDuration] = useState('');
  const [actionType, setActionType] = useState('apply');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  useEffect(() => {
    if (open && opportunity) {
      setTitle(opportunity.title);
      setDescription(opportunity.description);
      setType(opportunity.type);
      setStatus(opportunity.status);
      setCompany(opportunity.company || '');
      setLocation(opportunity.location || '');
      setIsRemote(opportunity.isRemote);
      setCompensation(opportunity.compensation || '');
      setExperienceLevel(opportunity.experienceLevel);
      setSelectedRoles((opportunity.roles || []).filter((r): r is UserRole => allRoles.includes(r as UserRole)));
      const dl = opportunity.deadline || '';
      setDeadlineDate(dl.includes('T') ? dl.split('T')[0] : dl);
      setDuration(opportunity.duration || '');
      setActionType(opportunity.actionType || 'apply');
      setImageUrl(opportunity.imageUrl || '');
      setLinkUrl(opportunity.linkUrl || '');
      setLinkTitle(opportunity.linkTitle || '');
    }
  }, [open, opportunity]);

  const toggleRole = (role: UserRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return;

    updateOpportunity.mutate({
      id: opportunity.id,
      title: title.trim(),
      description: description.trim(),
      type,
      status,
      company: company.trim() || undefined,
      location: location.trim() || 'Remote',
      is_remote: isRemote,
      compensation: compensation.trim() || undefined,
      experience_level: experienceLevel,
      roles: selectedRoles,
      deadline: deadlineDate || undefined,
      start_date: undefined,
      duration: duration.trim() || undefined,
      action_type: actionType,
      image_url: imageUrl || null,
      link_url: linkUrl.trim() || null,
      link_title: linkTitle.trim() || null,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[hsl(var(--neon-opportunities))]" />
            Edit Opportunity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label htmlFor="edit-type">Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="casting">Casting Call</SelectItem>
                    <SelectItem value="gig">Gig</SelectItem>
                    <SelectItem value="collaboration">Collaboration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-company">Company / Production</Label>
                <Input id="edit-company" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" disabled={isRemote} />
            </div>
            <div>
              <Label htmlFor="edit-compensation">Compensation</Label>
              <Input id="edit-compensation" value={compensation} onChange={(e) => setCompensation(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="edit-remote" checked={isRemote} onCheckedChange={setIsRemote} />
              <Label htmlFor="edit-remote">Remote opportunity</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-experience">Experience Level</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="any">Any Level</SelectItem>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="senior">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-deadline">Date</Label>
              <Input id="edit-deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-duration">Duration</Label>
              <Input id="edit-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-actionType">Response Type</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="apply">Apply Online</SelectItem>
                  <SelectItem value="calendar">In-Person (Add to Calendar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                <ImageUploader
                  userId={user.id}
                  onImageUploaded={setImageUrl}
                  currentImageUrl={imageUrl || undefined}
                  onRemoveImage={() => setImageUrl('')}
                />
              </div>
            </div>
          )}

          {/* Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-linkUrl">Link URL (optional)</Label>
              <Input
                id="edit-linkUrl"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-linkTitle">Link Button Label</Label>
              <Input
                id="edit-linkTitle"
                placeholder="e.g., Visit Website"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || updateOpportunity.isPending}
              className="bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
            >
              {updateOpportunity.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditOpportunityDialog;
