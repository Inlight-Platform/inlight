import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, MapPin, Globe, Instagram } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const PublicCompanyStaffPage: React.FC = () => {
  const { companyId, userId } = useParams<{ companyId: string; userId: string }>();

  const { data: person, isLoading } = useQuery({
    queryKey: ['public-staff', companyId, userId],
    queryFn: async () => {
      // Verify this user is staff/owner/member of the company before showing
      const { data: staffRows, error: sErr } = await (supabase.rpc as any)('get_company_staff_ids', { _company_id: companyId });
      if (sErr) throw sErr;
      const allowed = (staffRows || []).some((r: any) => r.user_id === userId);
      if (!allowed) return null;
      const { data, error } = await (supabase.rpc as any)('get_public_profiles', { _user_ids: [userId] });
      if (error) throw error;
      return (data || [])[0] || null;
    },
    enabled: !!companyId && !!userId,
  });

  if (isLoading) {
    return <div className="min-h-screen p-6"><Skeleton className="h-10 w-64 mb-3" /><Skeleton className="h-4 w-96" /></div>;
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Profile not available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Link to={`/c/${companyId}`} className="fixed top-4 left-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm shadow-card hover:bg-accent transition-colors" aria-label="Back">
        <ChevronLeft className="w-6 h-6" />
      </Link>

      {person.cover_url && (
        <div className="h-[200px] sm:h-[280px] w-full overflow-hidden">
          <img src={person.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {person.avatar_url ? (
            <img src={person.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-card -mt-12 sm:mt-0" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-2xl font-semibold border-4 border-background shadow-card -mt-12 sm:mt-0">
              {(person.display_name || '?').charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              {person.stage_name || person.display_name}
            </h1>
            {person.headline && <p className="text-sm text-muted-foreground mt-1">{person.headline}</p>}
            {person.role && <Badge variant="secondary" className="mt-2">{person.role}</Badge>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {person.location && (<span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{person.location}</span>)}
              {person.website_url && (
                <a href={person.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="w-4 h-4" />Website
                </a>
              )}
              {person.instagram_url && (
                <a href={person.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Instagram className="w-4 h-4" />Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        {person.bio && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">About</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{person.bio}</p>
          </section>
        )}

        {Array.isArray(person.skills) && person.skills.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {person.skills.map((s: string) => (
                <Badge key={s} variant="outline">{s}</Badge>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">Powered by Inlight</footer>
    </div>
  );
};

export default PublicCompanyStaffPage;