import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  Plus, 
  Users, 
  Camera, 
  Trash2, 
  UserPlus,
  Bookmark,
  BookmarkCheck,
  Upload,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPhotoUpload } from '@/hooks/useProjectPhotoUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { toast } from 'sonner';
import { ProjectTimeline } from '@/components/projects/ProjectTimeline';
import { OpenRolesDisplay } from '@/components/projects/OpenRolesDisplay';
import { ProjectStatusDropdown } from '@/components/projects/ProjectStatusDropdown';

interface ProjectMember {
  id: string;
  user_id: string;
  role: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ProjectPhoto {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  created_at: string;
}

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addPhotoOpen, setAddPhotoOpen] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadPhoto, uploading, progress } = useProjectPhotoUpload();

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;

      // Fetch creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', data.creator_id)
        .single();

      return { ...data, creator_profile: creatorProfile };
    },
    enabled: !!projectId,
  });

  // Fetch project members
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) throw error;

      // Fetch member profiles
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id)
      })) as ProjectMember[];
    },
    enabled: !!projectId,
  });

  // Fetch project photos
  const { data: photos = [] } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_photos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProjectPhoto[];
    },
    enabled: !!projectId,
  });

  // Check if saved
  const { data: isSaved } = useQuery({
    queryKey: ['project-saved', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user?.id) return false;
      const { data } = await supabase
        .from('saved_projects')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!projectId && !!user?.id,
  });

  const isCreator = project?.creator_id === user?.id;
  const isMember = members.some(m => m.user_id === user?.id) || isCreator;

  // Handle file upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const result = await uploadPhoto(file, projectId, user.id, photoCaption);
    
    if (result) {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      setPhotoCaption('');
      setAddPhotoOpen(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('project_photos')
        .delete()
        .eq('id', photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      toast.success('Photo deleted');
    },
    onError: () => toast.error('Failed to delete photo'),
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !memberEmail.trim()) throw new Error('Invalid data');
      
      // Find user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', memberEmail.trim())
        .maybeSingle();

      if (!profile) throw new Error('User not found');

      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: profile.user_id,
          role: memberRole.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      setMemberEmail('');
      setMemberRole('');
      setAddMemberOpen(false);
      toast.success('Member added!');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add member'),
  });

  // Toggle save mutation
  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !user?.id) throw new Error('Must be logged in');
      if (isSaved) {
        const { error } = await supabase
          .from('saved_projects')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_projects')
          .insert({ project_id: projectId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-saved', projectId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      toast.success(isSaved ? 'Removed from saved' : 'Project saved!');
    },
    onError: () => toast.error('Failed to update'),
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      if (!projectId) throw new Error('No project ID');
      const { error } = await supabase
        .from('projects')
        .update({ description: newDescription })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsEditingDescription(false);
      toast.success('Description updated');
    },
    onError: () => toast.error('Failed to update description'),
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async (roleName: string) => {
      if (!projectId) throw new Error('No project ID');
      const { error } = await supabase
        .from('project_roles')
        .insert({ project_id: projectId, role_name: roleName });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-roles', projectId] });
      setNewRoleName('');
      setAddRoleOpen(false);
      toast.success('Role added');
    },
    onError: () => toast.error('Failed to add role'),
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('project_roles')
        .delete()
        .eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-roles', projectId] });
      toast.success('Role removed');
    },
    onError: () => toast.error('Failed to remove role'),
  });

  // Handle cover image upload
  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/projects/${projectId}/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('projects')
        .update({ header_image_url: urlData.publicUrl })
        .eq('id', projectId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Cover image updated');
    } catch (error) {
      console.error('Cover upload error:', error);
      toast.error('Failed to upload cover image');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">{project.title}</h1>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleSaveMutation.mutate()}
              >
                {isSaved ? (
                  <BookmarkCheck className="w-5 h-5 text-primary" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </Button>
              {isCreator && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteProjectDialogOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Header Image */}
        <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden bg-muted">
          {project.header_image_url ? (
            <img
              src={project.header_image_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {isCreator ? 'Click to add a cover image' : 'No cover image'}
            </div>
          )}
          {isCreator && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
                id="cover-upload"
              />
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-4 right-4"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
              >
                {isUploadingCover ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4 mr-2" />
                )}
                {project.header_image_url ? 'Change Cover' : 'Add Cover'}
              </Button>
            </>
          )}
        </div>

        {/* Project Timeline */}
        {project.status && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Project Status</CardTitle>
              {isCreator && (
                <ProjectStatusDropdown 
                  projectId={projectId!} 
                  currentStatus={project.status} 
                />
              )}
            </CardHeader>
            <CardContent>
              <ProjectTimeline status={project.status} />
            </CardContent>
          </Card>
        )}

        {/* Main Project Info */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={project.creator_profile?.avatar_url || undefined} />
              <AvatarFallback>
                {project.creator_profile?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">
                {project.creator_profile?.display_name || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">Project Creator</p>
            </div>
          </div>

          {project.main_image_url && !project.header_image_url && (
            <img
              src={project.main_image_url}
              alt={project.title}
              className="w-full max-h-96 object-cover rounded-lg mb-4"
            />
          )}

          {/* Editable Description */}
          <div className="space-y-2">
            {isEditingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Describe your project..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateDescriptionMutation.mutate(editedDescription)}
                    disabled={updateDescriptionMutation.isPending}
                  >
                    {updateDescriptionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingDescription(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                {project.description ? (
                  <p className="text-muted-foreground">{project.description}</p>
                ) : isCreator ? (
                  <p className="text-muted-foreground italic">Click to add a description...</p>
                ) : null}
                {isCreator && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditedDescription(project.description || '');
                      setIsEditingDescription(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Open Roles - Collapsible */}
        {project.is_public && (
          <Collapsible open={rolesOpen} onOpenChange={setRolesOpen}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <CardTitle className="text-lg">Open Roles</CardTitle>
                    {rolesOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                {isCreator && (
                  <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Role
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Open Role</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Input
                          placeholder="Role name (e.g., Gaffer, Sound Mixer)"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                        />
                        <Button
                          onClick={() => addRoleMutation.mutate(newRoleName)}
                          disabled={!newRoleName.trim() || addRoleMutation.isPending}
                          className="w-full"
                        >
                          Add Role
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <OpenRolesDisplay 
                    projectId={projectId!} 
                    creatorId={project.creator_id}
                    onDeleteRole={isCreator ? (roleId) => deleteRoleMutation.mutate(roleId) : undefined}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Members Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members ({members.filter(m => m.user_id !== project.creator_id).length + 1})
            </CardTitle>
            {isCreator && (
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Member email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                    />
                    <Input
                      placeholder="Role (optional)"
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                    />
                    <Button 
                      onClick={() => addMemberMutation.mutate()}
                      disabled={addMemberMutation.isPending}
                      className="w-full"
                    >
                      Add Member
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {/* Creator */}
              <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded-lg p-2 transition-colors"
                onClick={() => navigate(`/profile/${project.creator_id}`)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={project.creator_profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {project.creator_profile?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{project.creator_profile?.display_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">Creator</p>
                </div>
              </div>

              {/* Other members (excluding creator to avoid duplicates) */}
              {members
                .filter(member => member.user_id !== project.creator_id)
                .map(member => (
                  <div 
                    key={member.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded-lg p-2 transition-colors"
                    onClick={() => navigate(`/profile/${member.user_id}`)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.profile?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{member.profile?.display_name || 'Unknown'}</p>
                      {member.role && (
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Photos Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Project Photos ({photos.length})
            </CardTitle>
            {isMember && (
              <Dialog open={addPhotoOpen} onOpenChange={setAddPhotoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Photo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Photo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Textarea
                      placeholder="Caption (optional)"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      disabled={uploading}
                    />
                    {uploading && progress && (
                      <div className="space-y-2">
                        <Progress value={progress.percentage} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                          Uploading... {progress.percentage}%
                        </p>
                      </div>
                    )}
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose Photo
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.image_url}
                      alt={photo.caption || 'Project photo'}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    {photo.caption && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {photo.caption}
                      </p>
                    )}
                    {(isCreator || photo.user_id === user?.id) && (
                      <button
                        onClick={() => deletePhotoMutation.mutate(photo.id)}
                        className="absolute top-2 right-2 p-1.5 bg-destructive/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-destructive-foreground" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Project Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteProjectDialogOpen}
        onOpenChange={setDeleteProjectDialogOpen}
        onConfirm={() => deleteProjectMutation.mutate()}
        title="Delete this project?"
        description="This will permanently delete this project, including all photos and team members. This action cannot be undone."
        isPending={deleteProjectMutation.isPending}
      />
    </div>
  );
};

export default ProjectDetailPage;
