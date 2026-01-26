import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Upload, Users, Calendar, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PROJECT_CATEGORIES, ProjectCategory } from '@/components/projects/ProjectCreator';
import { RoleSlotBuilder, RoleSlot } from '@/components/projects/RoleSlotBuilder';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'basics', label: 'Basics', icon: Calendar },
  { id: 'roles', label: 'Team Roles', icon: Users },
  { id: 'media', label: 'Media', icon: Upload },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type StepId = typeof STEPS[number]['id'];

interface ProjectWizardProps {
  onClose: () => void;
}

export const ProjectWizard: React.FC<ProjectWizardProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<StepId>('basics');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('other');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roles, setRoles] = useState<RoleSlot[]>([]);
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [postApprovalRequired, setPostApprovalRequired] = useState<'open' | 'approval'>('open');
  const [isPublic, setIsPublic] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !title.trim()) throw new Error('Invalid data');

      // 1. Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          main_image_url: mainImageUrl.trim() || null,
          creator_id: user.id,
          category,
          status: 'pre-production',
          is_public: isPublic,
          post_approval_required: postApprovalRequired === 'approval',
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .select('id, title')
        .single();

      if (projectError) throw projectError;

      // 2. Add creator as a member
      await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: user.id,
        role: 'Creator',
      });

      // 3. Create project roles and send invitations
      for (const role of roles) {
        if (!role.roleName.trim()) continue;

        const { data: projectRole, error: roleError } = await supabase
          .from('project_roles')
          .insert({
            project_id: project.id,
            role_name: role.roleName.trim(),
            assigned_user_id: role.assignedUser?.user_id || null,
          })
          .select('id')
          .single();

        if (roleError) throw roleError;

        // If user is assigned, create an invitation
        if (role.assignedUser) {
          await supabase.from('project_invitations').insert({
            project_role_id: projectRole.id,
            sender_id: user.id,
            receiver_id: role.assignedUser.user_id,
            status: 'pending',
          });
        }
      }

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects-feed'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      toast.success('Project created! Invitations sent to team members.');
      onClose();
      navigate(`/projects/${project.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const canProceed = () => {
    switch (currentStep) {
      case 'basics':
        return title.trim().length > 0;
      case 'roles':
        return true; // Optional
      case 'media':
        return true; // Optional
      case 'settings':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    createProjectMutation.mutate();
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => {
                  if (index <= currentStepIndex || canProceed()) {
                    setCurrentStep(step.id);
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-1 transition-colors',
                  isActive && 'text-primary',
                  isCompleted && 'text-primary/70',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                    isActive && 'border-primary bg-primary/10',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'border-muted-foreground/30'
                  )}
                >
                  <StepIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {currentStep === 'basics' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="What's your project called?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell us about your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProjectCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timeline</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">End Date</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'roles' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              What roles are you seeking? Invite team members to join your project.
            </p>
            <RoleSlotBuilder
              roles={roles}
              onChange={setRoles}
              excludeUserIds={[user.id]}
            />
          </div>
        )}

        {currentStep === 'media' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mainImage">Cover Image URL</Label>
              <Input
                id="mainImage"
                placeholder="https://example.com/image.jpg"
                value={mainImageUrl}
                onChange={(e) => setMainImageUrl(e.target.value)}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Add a cover image for your project
              </p>
            </div>

            {mainImageUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img
                  src={mainImageUrl}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {currentStep === 'settings' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Team Posting Permissions</Label>
              <p className="text-sm text-muted-foreground">
                How should team members post behind-the-scenes content?
              </p>
              <RadioGroup
                value={postApprovalRequired}
                onValueChange={(v) => setPostApprovalRequired(v as 'open' | 'approval')}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="open" id="open" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="open" className="font-medium cursor-pointer">
                      Post without admin permission
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Team members can post updates and photos directly
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="approval" id="approval" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="approval" className="font-medium cursor-pointer">
                      Post with admin permission
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      You'll review and approve posts before they're visible
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Visibility</Label>
              <RadioGroup
                value={isPublic ? 'public' : 'private'}
                onValueChange={(v) => setIsPublic(v === 'public')}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="private" id="private" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="private" className="font-medium cursor-pointer">
                      Private
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Only visible to you and team members
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="public" id="public" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="public" className="font-medium cursor-pointer">
                      Public (Open Roles Feed)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Share your project and open roles with the community
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStepIndex === 0 ? onClose : handleBack}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStepIndex === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createProjectMutation.isPending}
          >
            {createProjectMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
