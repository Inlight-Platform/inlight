import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Briefcase, Loader2 } from 'lucide-react';

interface OpenRoleProject {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  category: string | null;
  status: string | null;
  creator_profile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  open_roles: string[];
}

export const OpenRolesFeed: React.FC = () => {
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['open-roles-feed'],
    queryFn: async () => {
      // Fetch public projects
      const { data: publicProjects, error: projectError } = await supabase
        .from('projects')
        .select('id, title, description, main_image_url, category, status, creator_id')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (projectError) throw projectError;
      if (!publicProjects?.length) return [];

      // Fetch open roles (roles without assigned users)
      const projectIds = publicProjects.map(p => p.id);
      const { data: roles } = await supabase
        .from('project_roles')
        .select('project_id, role_name, assigned_user_id')
        .in('project_id', projectIds)
        .is('assigned_user_id', null);

      // Group open roles by project
      const openRolesMap = new Map<string, string[]>();
      roles?.forEach(role => {
        const existing = openRolesMap.get(role.project_id) || [];
        openRolesMap.set(role.project_id, [...existing, role.role_name]);
      });

      // Only keep projects with open roles
      const projectsWithOpenRoles = publicProjects.filter(p => 
        openRolesMap.has(p.id) && (openRolesMap.get(p.id)?.length || 0) > 0
      );

      if (!projectsWithOpenRoles.length) return [];

      // Fetch creator profiles
      const creatorIds = [...new Set(projectsWithOpenRoles.map(p => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return projectsWithOpenRoles.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        main_image_url: project.main_image_url,
        category: project.category,
        status: project.status,
        creator_profile: profileMap.get(project.creator_id) || null,
        open_roles: openRolesMap.get(project.id) || [],
      })) as OpenRoleProject[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No projects with open roles right now</p>
        <p className="text-sm text-muted-foreground mt-1">Check back later for opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Projects Looking for Team Members</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <Card
            key={project.id}
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            {/* Project Image */}
            {project.main_image_url ? (
              <img
                src={project.main_image_url}
                alt={project.title}
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No image</span>
              </div>
            )}

            <CardContent className="p-4">
              {/* Creator */}
              {project.creator_profile && (
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={project.creator_profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {project.creator_profile.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {project.creator_profile.display_name || 'Unknown'}
                  </span>
                </div>
              )}

              {/* Title & Category */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground line-clamp-1">{project.title}</h3>
                {project.category && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {project.category}
                  </Badge>
                )}
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {project.description}
                </p>
              )}

              {/* Open Roles */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Looking for:
                </p>
                <div className="flex flex-wrap gap-1">
                  {project.open_roles.slice(0, 3).map((role, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                  {project.open_roles.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{project.open_roles.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
