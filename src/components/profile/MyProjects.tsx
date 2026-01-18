import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Folder, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Project {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  creator_id: string;
  role?: string;
}

interface MyProjectsProps {
  userId: string;
  isOwnProfile: boolean;
}

export const MyProjects: React.FC<MyProjectsProps> = ({ userId, isOwnProfile }) => {
  const navigate = useNavigate();

  // Fetch projects where user is creator or member
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['user-projects', userId],
    queryFn: async () => {
      // Get projects user created
      const { data: createdProjects, error: createdError } = await supabase
        .from('projects')
        .select('id, title, description, main_image_url, creator_id')
        .eq('creator_id', userId);

      if (createdError) throw createdError;

      // Get projects user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      // Get project details for memberships (excluding ones user created)
      const memberProjectIds = memberships
        ?.map(m => m.project_id)
        .filter(id => !createdProjects?.some(p => p.id === id)) || [];

      let memberProjects: Project[] = [];
      if (memberProjectIds.length > 0) {
        const { data: memberProjectsData } = await supabase
          .from('projects')
          .select('id, title, description, main_image_url, creator_id')
          .in('id', memberProjectIds);

        memberProjects = (memberProjectsData || []).map(p => ({
          ...p,
          role: memberships?.find(m => m.project_id === p.id)?.role || undefined
        }));
      }

      // Combine and mark created projects
      const allProjects = [
        ...(createdProjects || []).map(p => ({ ...p, role: 'Creator' as string })),
        ...memberProjects
      ];

      return allProjects;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <Folder className="w-5 h-5" />
          Projects
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <Folder className="w-5 h-5" />
          Projects ({projects.length})
        </h2>
        {isOwnProfile && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/projects')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            {isOwnProfile ? "You haven't joined any projects yet" : "No projects to show"}
          </p>
          {isOwnProfile && (
            <Button onClick={() => navigate('/projects')}>
              Browse Projects
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Card 
              key={project.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              {project.main_image_url ? (
                <img
                  src={project.main_image_url}
                  alt={project.title}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-muted flex items-center justify-center">
                  <Folder className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-3">
                <h3 className="font-medium text-foreground text-sm mb-1 line-clamp-1">
                  {project.title}
                </h3>
                {project.role && (
                  <span className="text-xs text-muted-foreground">
                    {project.role}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="mt-4 text-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/projects')}
          >
            View All Projects
          </Button>
        </div>
      )}
    </section>
  );
};
