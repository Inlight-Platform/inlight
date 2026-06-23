import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ProjectHeaderImageUploader } from './ProjectHeaderImageUploader';
import { RoleSlotBuilder, RoleSlot } from './RoleSlotBuilder';

export const PROJECT_CATEGORIES = [
  { value: 'film', label: 'Film' },
  { value: 'theater', label: 'Theatre' },
  { value: 'music', label: 'Music' },
  { value: 'dance', label: 'Dance' },
  { value: 'photography', label: 'Photography' },
  { value: 'other', label: 'Other' },
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]['value'];

interface ProjectCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ProjectCreator: React.FC<ProjectCreatorProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('other');
  const [roles, setRoles] = useState<RoleSlot[]>([]);

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !title.trim()) throw new Error('Invalid data');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          main_image_url: mainImageUrl.trim() || null,
          creator_id: user.id,
          category,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Automatically add creator as a member
      await supabase
        .from('project_members')
        .insert({
          project_id: data.id,
          user_id: user.id,
          role: 'Creator',
        });

      for (const role of roles) {
        if (!role.roleName.trim()) continue;

        const { data: projectRole, error: roleError } = await supabase
          .from('project_roles')
          .insert({
            project_id: data.id,
            role_name: role.roleName.trim(),
            assigned_user_id: role.assignedUser?.user_id || null,
          })
          .select('id')
          .single();

        if (roleError) throw roleError;

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

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-feed'] });
      setTitle('');
      setDescription('');
      setMainImageUrl('');
      setCategory('other');
      setRoles([]);
      onOpenChange(false);
      onSuccess?.();
      toast.success('Project created!');
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
    createProjectMutation.mutate();
  };

  // This dialog can be mounted while closed from routes that do not yet have
  // an auth user resolved. Avoid dereferencing `user.id` during those renders.
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ProjectCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
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
            <Label>Main Image</Label>
            <p className="text-xs text-muted-foreground">
              This is the project thumbnail shown in feeds and cards.
            </p>
            <ProjectHeaderImageUploader
              userId={user.id}
              currentImageUrl={mainImageUrl}
              onImageUploaded={setMainImageUrl}
              onRemoveImage={() => setMainImageUrl('')}
              imageKind="main"
              cropTitle="Crop main project image"
              helperText="Drag and drop or click to upload main image"
              recommendedDimensions="Recommended: 1200×900 or similar poster/card format"
              aspect={4 / 3}
              outputWidth={1200}
              outputHeight={900}
            />
          </div>

          <div className="pt-2 border-t border-border">
            <RoleSlotBuilder
              roles={roles}
              onChange={setRoles}
              excludeUserIds={[user.id]}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProjectMutation.isPending}
              className="flex-1"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
