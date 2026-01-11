import React, { useState } from 'react';
import { X, Plus, Briefcase } from 'lucide-react';
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
import { OpportunityType, ExperienceLevel, UserRole, useStore } from '@/store/useStore';

interface OpportunityCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OpportunityCreator: React.FC<OpportunityCreatorProps> = ({ open, onOpenChange }) => {
  const { currentUserId, addOpportunity } = useStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OpportunityType>('job');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('any');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [deadline, setDeadline] = useState('');
  const [duration, setDuration] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);

  const allRoles: UserRole[] = ['Actor', 'Director', 'Producer', 'Musician'];

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
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

    addOpportunity({
      title: title.trim(),
      description: description.trim(),
      type,
      status: 'open',
      postedBy: currentUserId,
      company: company.trim() || undefined,
      location: location.trim() || 'Remote',
      isRemote,
      compensation: compensation.trim() || undefined,
      experienceLevel,
      roles: selectedRoles,
      requirements: [],
      deadline: deadline || undefined,
      duration: duration.trim() || undefined,
      tags,
      isFeatured,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setType('job');
    setCompany('');
    setLocation('');
    setIsRemote(false);
    setCompensation('');
    setExperienceLevel('any');
    setSelectedRoles([]);
    setDeadline('');
    setDuration('');
    setTags([]);
    setIsFeatured(false);
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
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
                <Select value={type} onValueChange={(v) => setType(v as OpportunityType)}>
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

            <div className="flex items-center gap-3">
              <Switch
                id="featured"
                checked={isFeatured}
                onCheckedChange={setIsFeatured}
              />
              <Label htmlFor="featured">Featured listing</Label>
            </div>
          </div>

          {/* Experience & Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="experience">Experience Level</Label>
              <Select value={experienceLevel} onValueChange={(v) => setExperienceLevel(v as ExperienceLevel)}>
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="any">Any Level</SelectItem>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="deadline">Application Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
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
          </div>

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

          {/* Tags */}
          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim()}
              className="bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
            >
              Post Opportunity
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityCreator;
