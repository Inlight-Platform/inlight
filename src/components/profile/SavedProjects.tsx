import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Project {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  creator_id: string;
  created_at: string;
  category: string | null;
  creator_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const PROJECT_CATEGORIES = [
  { value: 'film', label: 'Film' },
  { value: 'theater', label: 'Theater' },
  { value: 'television', label: 'Television' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'web-series', label: 'Web Series' },
  { value: 'short-film', label: 'Short Film' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'other', label: 'Other' },
];

export const SavedProjects: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch saved projects with details
  const { data: savedProjects = [], isLoading } = useQuery({
    queryKey: ['saved-projects-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: saved, error } = await supabase
        .from('saved_projects')
        .select('id, project_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      if (!saved.length) return [];

      const projectIds = saved.map(s => s.project_id);
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      // Fetch creator profiles
      const creatorIds = [...new Set(projectsData?.map(p => p.creator_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return projectsData?.map(project => ({
        ...project,
        creator_profile: profileMap.get(project.creator_id)
      })) || [];
    },
    enabled: !!user?.id,
  });

  // Unsave project mutation
  const unsaveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_projects')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-projects-profile'] });
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      queryClient.invalidateQueries({ queryKey: ['saved-projects-details'] });
      toast.success('Project removed from saved');
    },
    onError: () => toast.error('Failed to remove project'),
  });

  const getCategoryLabel = (category: string | null) => {
    return PROJECT_CATEGORIES.find(c => c.value === category)?.label || 'Other';
  };

  if (!user) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-display font-semibold">Saved Projects</h2>
          <span className="text-sm text-muted-foreground">({savedProjects.length})</span>
        </div>
        <span className="text-xs text-muted-foreground">Only visible to you</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : savedProjects.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No saved projects yet.</p>
          <p className="text-sm mt-1">Browse projects and save the ones you like!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedProjects.map((project: Project) => (
            <Card 
              key={project.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="relative">
                {/* Creator profile */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={project.creator_profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {project.creator_profile?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">
                    {project.creator_profile?.display_name || 'Unknown'}
                  </span>
                </div>

                {/* Unsave button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unsaveProjectMutation.mutate(project.id);
                  }}
                  className="absolute top-3 right-3 z-10 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors"
                >
                  <BookmarkCheck className="w-5 h-5 text-primary" />
                </button>

                {/* Main image */}
                {project.main_image_url ? (
                  <img
                    src={project.main_image_url}
                    alt={project.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">No image</span>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                  <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                    {getCategoryLabel(project.category)}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};