import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Folder, Plus, Bookmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Project {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  header_image_url?: string | null;
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
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['user-projects', userId],
    queryFn: async () => {
      const { data: createdProjects, error: createdError } = await supabase
        .from('projects')
        .select('id, title, description, main_image_url, header_image_url, creator_id')
        .eq('creator_id', userId);

      if (createdError) throw createdError;

      const { data: memberships, error: memberError } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      const safeCreatedProjects = (createdProjects || []).filter((project): project is Project => Boolean(project?.id));

      const memberProjectIds = memberships
        ?.map(m => m.project_id)
        .filter(Boolean)
        .filter(id => !safeCreatedProjects.some(p => p.id === id)) || [];

      let memberProjects: Project[] = [];
      if (memberProjectIds.length > 0) {
        const { data: memberProjectsData } = await supabase
          .from('projects')
          .select('id, title, description, main_image_url, header_image_url, creator_id')
          .in('id', memberProjectIds);

        memberProjects = (memberProjectsData || []).filter((project): project is Project => Boolean(project?.id)).map(p => ({
          ...p,
          role: memberships?.find(m => m.project_id === p.id)?.role || undefined
        }));
      }

      const allProjects = [
        ...safeCreatedProjects.map(p => ({ ...p, role: 'Creator' as string })),
        ...memberProjects
      ];

      return allProjects;
    },
    enabled: !!userId,
  });

  // Fetch saved projects (only for own profile)
  const { data: savedProjects = [], isLoading: loadingSaved } = useQuery({
    queryKey: ['user-saved-projects', userId],
    queryFn: async () => {
      const { data: saved, error } = await supabase
        .from('saved_projects')
        .select('project_id')
        .eq('user_id', userId);

      if (error) throw error;
      if (!saved?.length) return [];

      const projectIds = saved.map(s => s.project_id).filter(Boolean);
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, title, description, main_image_url, header_image_url, creator_id')
        .in('id', projectIds);

      return (projectsData || []).filter((project): project is Project => Boolean(project?.id));
    },
    enabled: !!userId && isOwnProfile,
  });

  const ProjectCard = ({ project, showRole = false }: { project: Project; showRole?: boolean }) => (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {project.header_image_url || project.main_image_url ? (
        <img
          src={project.header_image_url || project.main_image_url || undefined}
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
        {showRole && project.role && (
          <span className="text-xs text-muted-foreground">
            {project.role}
          </span>
        )}
      </CardContent>
    </Card>
  );

  const ProjectGrid = ({ items, emptyMessage, showRole = false }: { 
    items: Project[]; 
    emptyMessage: string;
    showRole?: boolean;
  }) => (
    items.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">{emptyMessage}</p>
        <Button onClick={() => navigate('/projects')}>
          Browse Projects
        </Button>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(project => (
          <ProjectCard key={project.id} project={project} showRole={showRole} />
        ))}
      </div>
    )
  );

  const isLoading = loadingProjects || loadingSaved;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {isOwnProfile && (
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/projects')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      )}

      {isOwnProfile ? (
        <Tabs defaultValue="my-projects" className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2 mb-4">
            <TabsTrigger value="my-projects" className="flex items-center gap-1">
              <Folder className="w-4 h-4" />
              My Projects ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-1">
              <Bookmark className="w-4 h-4" />
              Saved ({savedProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects">
            <ProjectGrid 
              items={projects} 
              emptyMessage="You haven't joined any projects yet"
              showRole
            />
          </TabsContent>

          <TabsContent value="saved">
            <ProjectGrid 
              items={savedProjects} 
              emptyMessage="No saved projects yet"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ProjectGrid 
          items={projects} 
          emptyMessage="No projects to show"
          showRole
        />
      )}

      {(projects.length > 0 || savedProjects.length > 0) && (
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
    </div>
  );
};
