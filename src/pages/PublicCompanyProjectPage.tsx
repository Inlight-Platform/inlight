import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PublicCompanyProjectPage: React.FC = () => {
  const { companyId, projectId } = useParams<{ companyId: string; projectId: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ['public-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .eq('company_id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!companyId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['public-project-members', projectId],
    queryFn: async () => {
      const { data: mem, error } = await supabase
        .from('project_members')
        .select('user_id, role')
        .eq('project_id', projectId!);
      if (error) throw error;
      const ids = (mem || []).map(m => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await (supabase.rpc as any)('get_public_profiles', { _user_ids: ids });
      if (pErr) throw pErr;
      return (mem || []).map(m => ({ ...m, profile: (profiles || []).find((p: any) => p.user_id === m.user_id) }));
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="min-h-screen p-6"><Skeleton className="h-10 w-64 mb-3" /><Skeleton className="h-4 w-96" /></div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Link to={`/c/${companyId}`} className="fixed top-4 left-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm shadow-card hover:bg-accent transition-colors" aria-label="Back to company">
        <ChevronLeft className="w-6 h-6" />
      </Link>

      {(project.header_image_url || project.main_image_url) && (
        <div className="h-[220px] sm:h-[320px] w-full overflow-hidden">
          <img src={project.header_image_url || project.main_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">{project.title}</h1>
          {project.category && <p className="text-sm text-muted-foreground mt-1">{project.category}</p>}
          {(project.start_date || project.end_date) && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <CalendarDays className="w-4 h-4" />
              {project.start_date || ''}{project.end_date ? ` – ${project.end_date}` : ''}
            </p>
          )}
        </div>
        {project.description && (
          <p className="whitespace-pre-wrap text-foreground leading-relaxed">{project.description}</p>
        )}

        {members.length > 0 && (
          <section>
            <h2 className="text-lg font-display font-semibold mb-3">Team</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {members.map((m: any) => m.profile && (
                <Link
                  key={m.user_id}
                  to={`/c/${companyId}/staff/${m.user_id}`}
                  className="flex flex-col items-center text-center p-4 rounded-xl border border-border hover:shadow-lg transition-shadow bg-card"
                >
                  {m.profile.avatar_url ? (
                    <img src={m.profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold mb-2">
                      {(m.profile.display_name || '?').charAt(0)}
                    </div>
                  )}
                  <p className="font-semibold text-sm truncate w-full">{m.profile.stage_name || m.profile.display_name}</p>
                  {(m.role || m.profile.role) && <p className="text-xs text-muted-foreground truncate w-full">{m.role || m.profile.role}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">Powered by Inlight</footer>
    </div>
  );
};

export default PublicCompanyProjectPage;