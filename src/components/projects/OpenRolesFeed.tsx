import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Calendar } from 'lucide-react';
import { format, addMonths } from 'date-fns';

interface OpenRole {
  roleId: string;
  roleName: string;
  projectId: string;
  projectTitle: string;
  projectDeadline: string | null;
  createdAt: string;
}

export const OpenRolesFeed: React.FC = () => {
  const navigate = useNavigate();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['open-roles-feed'],
    queryFn: async () => {
      // Fetch unassigned roles
      const { data: openRoles, error } = await supabase
        .from('project_roles')
        .select('id, role_name, project_id, created_at')
        .is('assigned_user_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!openRoles?.length) return [];

      // Fetch parent projects (only public ones)
      const projectIds = [...new Set(openRoles.map(r => r.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, end_date')
        .eq('is_public', true)
        .in('id', projectIds);

      if (!projects?.length) return [];

      const projectMap = new Map(projects.map(p => [p.id, p]));

      return openRoles
        .filter(r => projectMap.has(r.project_id))
        .map(r => {
          const project = projectMap.get(r.project_id)!;
          return {
            roleId: r.id,
            roleName: r.role_name,
            projectId: r.project_id,
            projectTitle: project.title,
            projectDeadline: project.end_date,
            createdAt: r.created_at,
          } as OpenRole;
        });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No open roles right now</p>
        <p className="text-sm text-muted-foreground mt-1">Check back later for opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map(role => {
          const deadlineDate = role.projectDeadline ? new Date(role.projectDeadline) : null;
          const applyBy = deadlineDate && !isNaN(deadlineDate.getTime())
            ? deadlineDate
            : addMonths(new Date(role.createdAt || Date.now()), 1);

          return (
            <div
              key={role.roleId}
              onClick={() => navigate(`/projects/${role.projectId}`)}
              className="flex flex-col justify-between gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm leading-tight">
                  {role.roleName}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {role.projectTitle}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>Apply by {format(applyBy, 'MMM d, yyyy')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
