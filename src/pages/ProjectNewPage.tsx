import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { ProjectHeaderImageUploader } from '@/components/projects/ProjectHeaderImageUploader';

const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'wrapping', label: 'Wrapping' },
  { value: 'archived', label: 'Archived' },
] as const;

type ProjectStatus = typeof PROJECT_STATUSES[number]['value'];

const ProjectNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('other');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [isPublic, setIsPublic] = useState(false);
  const [roles, setRoles] = useState<RoleSlot[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // Auto-set status to archived if end date is in the past
  const effectiveStatus = endDate && endDate < new Date(new Date().toDateString()) ? 'archived' : status;

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
          header_image_url: headerImageUrl.trim() || null,
          creator_id: user.id,
          category,
          status: effectiveStatus,
          is_public: isPublic,
          start_date: startDate ? startDate.toISOString().split('T')[0] : null,
          end_date: endDate ? endDate.toISOString().split('T')[0] : null,
          link_url: linkUrl.trim() || null,
          link_title: linkTitle.trim() || null,
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

        // Create the role
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
          const { error: invitationError } = await supabase
            .from('project_invitations')
            .insert({
              project_role_id: projectRole.id,
              sender_id: user.id,
              receiver_id: role.assignedUser.user_id,
              status: 'pending',
            });

          if (invitationError) throw invitationError;
        }
      }

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects-feed'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      toast.success('Project created! Invitations sent to assigned team members.');
      navigate(`/projects/${project.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    if (!mainImageUrl.trim() && !headerImageUrl.trim()) {
      toast.error('Please add an image for your project');
      return;
    }
    createProjectMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You must be logged in to create a project</p>
          <Button onClick={() => navigate('/auth')}>Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => safeBack(navigate, '/projects')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-display font-bold">Create Project</h1>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Project Details</h2>
            
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="Enter project title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {endDate && endDate < new Date(new Date().toDateString()) && (
              <p className="text-sm text-amber-500 font-medium">
                ⚠ End date is in the past — this project will be automatically archived.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="mainImage">Main Image URL *</Label>
              <Input
                id="mainImage"
                placeholder="https://example.com/image.jpg"
                value={mainImageUrl}
                onChange={(e) => setMainImageUrl(e.target.value)}
                type="url"
              />
              {mainImageUrl && (
                <div className="rounded-lg overflow-hidden mt-2">
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

            {/* Optional Link */}
            <div className="space-y-2">
              <Label htmlFor="linkUrl">Link URL (optional)</Label>
              <Input
                id="linkUrl"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Add a website, trailer, or external page related to your project
              </p>
            </div>

            {linkUrl && (
              <div className="space-y-2">
                <Label htmlFor="linkTitle">Link Display Title (optional)</Label>
                <Input
                  id="linkTitle"
                  placeholder="e.g. Watch Trailer, Visit Website"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  maxLength={60}
                />
              </div>
            )}

            {/* Header Image Upload */}
            <div className="space-y-2">
              <Label>Header Image</Label>
              <p className="text-sm text-muted-foreground">
                This image appears at the top of your project page for all viewers
              </p>
              <ProjectHeaderImageUploader
                userId={user.id}
                currentImageUrl={headerImageUrl}
                onImageUploaded={setHeaderImageUrl}
                onRemoveImage={() => setHeaderImageUrl('')}
              />
            </div>
          </div>

          {/* Team Roles */}
          <div className="pt-6 border-t border-border">
            <RoleSlotBuilder
              roles={roles}
              onChange={setRoles}
              excludeUserIds={[user.id]}
            />
          </div>

          {/* Public Feed Toggle */}
          <div className="pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Post to Public Feed</Label>
                <p className="text-sm text-muted-foreground">
                  Share your project publicly and show open roles to the community
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => safeBack(navigate, '/projects')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProjectMutation.isPending}
              className="flex-1"
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
          </div>
        </form>
      </main>
    </div>
  );
};

export default ProjectNewPage;
