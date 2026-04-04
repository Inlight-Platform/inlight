import React, { useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useOpportunities } from '@/hooks/useOpportunities';
import { toast } from 'sonner';

interface OpportunityCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician' | 'Gaffer' | 'Grip' | 'DP' | 'AD' | 'Extras' | 'Singer' | 'Dancer' | 'Designer';

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
  const [duration, setDuration] = useState('');
  const [actionType, setActionType] = useState('apply');

  const allRoles: UserRole[] = ['Actor', 'Director', 'Producer', 'Musician', 'Gaffer', 'Grip', 'DP', 'AD', 'Extras', 'Singer', 'Dancer', 'Designer'];

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
      requirements: [],
      deadline: deadlineDate || undefined,
      start_date: undefined,
      duration: duration.trim() || undefined,
      tags: [],
      is_featured: false,
      action_type: actionType,
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
        setDuration('');
        setActionType('apply');
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
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="apply">Apply Online</SelectItem>
                  <SelectItem value="calendar">In-Person (Add to Calendar)</SelectItem>
                </SelectContent>
              </Select>
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
