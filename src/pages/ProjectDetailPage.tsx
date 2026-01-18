import React, { useState } from 'react';
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
  BookmarkCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');

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

  // Add photo mutation
  const addPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !user?.id || !photoUrl.trim()) throw new Error('Invalid data');
      const { error } = await supabase
        .from('project_photos')
        .insert({
          project_id: projectId,
          user_id: user.id,
          image_url: photoUrl.trim(),
          caption: photoCaption.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      setPhotoUrl('');
      setPhotoCaption('');
      setAddPhotoOpen(false);
      toast.success('Photo added!');
    },
    onError: () => toast.error('Failed to add photo'),
  });

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
          )}
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
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

          {project.main_image_url && (
            <img
              src={project.main_image_url}
              alt={project.title}
              className="w-full max-h-96 object-cover rounded-lg mb-4"
            />
          )}

          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </section>

        {/* Members Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members ({members.length + 1})
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

              {/* Other members */}
              {members.map(member => (
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
                    <DialogTitle>Add Photo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Image URL"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                    />
                    <Textarea
                      placeholder="Caption (optional)"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                    />
                    <Button 
                      onClick={() => addPhotoMutation.mutate()}
                      disabled={addPhotoMutation.isPending}
                      className="w-full"
                    >
                      Add Photo
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
    </div>
  );
};

export default ProjectDetailPage;
