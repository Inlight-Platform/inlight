import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Globe, MapPin, Sparkles, FolderKanban, Archive, Image as ImageIcon, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const PublicCompanyPage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();

  const { data: company, isLoading } = useQuery({
    queryKey: ['public-company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['public-company-projects', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, main_image_url, header_image_url, status, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['public-company-photos', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_photos')
        .select('id, image_url')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['public-company-staff', companyId],
    queryFn: async () => {
      const { data: idRows, error: idErr } = await (supabase.rpc as any)('get_company_staff_ids', { _company_id: companyId });
      if (idErr) throw idErr;
      const ids = (idRows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await (supabase.rpc as any)('get_public_profiles', { _user_ids: ids });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: invitedStaff = [] } = useQuery({
    queryKey: ['public-company-invited-staff', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_company_staff_access_public', { _company_id: companyId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-[280px] w-full" />
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  const brandPrimary = company.brand_primary_color || '#ff6b35';
  const brandAccent = company.brand_accent_color || '#ffd23f';
  const brandText = company.brand_text_color || '#1a1a1a';
  const funFacts: string[] = Array.isArray(company.fun_facts) ? (company.fun_facts as string[]) : [];

  const normalizeStatus = (s: string | null): string => {
    const map: Record<string, string> = { 'pre-production': 'planning', 'in-production': 'active', 'post-production': 'wrapping', 'completed': 'archived' };
    return map[s?.toLowerCase() || ''] || s || 'planning';
  };
  const current = projects.filter(p => normalizeStatus(p.status) !== 'archived');
  const past = projects.filter(p => normalizeStatus(p.status) === 'archived');

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — minimal, no nav to platform */}
      <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <Building2 className="w-5 h-5" style={{ color: brandPrimary }} />
          )}
          <span className="font-display font-semibold text-sm truncate">{company.name}</span>
        </div>
      </div>

      {/* Hero */}
      <header className="relative pt-10">
        <div className="relative h-[200px] sm:h-[280px] md:h-[350px] lg:h-[450px] overflow-hidden">
          {company.cover_image_url ? (
            <img src={company.cover_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-40 blur-3xl" style={{ background: brandAccent }} />
          <div className="absolute bottom-10 left-1/3 w-32 h-32 rounded-full opacity-30 blur-3xl" style={{ background: brandPrimary }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="absolute -top-16 sm:-top-20 left-4 sm:left-6 lg:left-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-card flex items-center justify-center shadow-card overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-primary" />
              )}
            </div>
          </div>
          <div className="pt-12 sm:pt-16">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight"
              style={{
                backgroundImage: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {company.name}
            </h1>
            {company.tagline && (
              <p className="mt-1 text-base sm:text-lg font-medium text-foreground/90 italic">"{company.tagline}"</p>
            )}
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
              {company.location && (<span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{company.location}</span>)}
              {company.website_url && (
                <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="w-4 h-4" />{company.website_url}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {company.description && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
          <p className="text-foreground">{company.description}</p>
        </section>
      )}

      {company.mission && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div
            className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brandPrimary}15, ${brandAccent}15)`, border: `1px solid ${brandPrimary}30` }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: brandPrimary }}>Our Mission</h2>
            <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap">{company.mission}</p>
          </div>
        </section>
      )}

      {funFacts.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: brandPrimary }} />
            <h2 className="text-lg font-display font-semibold">Fun facts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {funFacts.map((fact, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 shadow-card"
                style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`, color: brandText }}
              >
                <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">#{i + 1}</div>
                <p className="font-medium leading-snug">{fact}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Staff */}
      {(staff.length > 0 || invitedStaff.length > 0) && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display font-semibold">Team</h2>
            <Badge variant="secondary" className="text-xs">{staff.length + invitedStaff.length}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {staff.map((person: any) => (
              <Link
                key={person.user_id}
                to={`/c/${companyId}/staff/${person.user_id}`}
                className="flex flex-col items-center text-center p-4 rounded-xl border border-border hover:shadow-lg transition-shadow bg-card"
              >
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold mb-2">
                    {(person.display_name || '?').charAt(0)}
                  </div>
                )}
                <p className="font-semibold text-sm truncate w-full">{person.stage_name || person.display_name}</p>
                {person.role && <p className="text-xs text-muted-foreground truncate w-full">{person.role}</p>}
              </Link>
            ))}
            {invitedStaff.map((person: any) => {
              const displayName = person.staff_name || person.email;
              return (
                <div
                  key={`${person.email}-${displayName}`}
                  className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-card"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold mb-2">
                    {(displayName || '?').charAt(0)}
                  </div>
                  <p className="font-semibold text-sm truncate w-full">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate w-full">Staff</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Current Projects */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-display font-semibold">Current projects</h2>
          {current.length > 0 && <Badge variant="secondary" className="text-xs">{current.length}</Badge>}
        </div>
        {current.length === 0 ? (
          <p className="text-sm text-muted-foreground">No current projects.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {current.map((p) => (
              <Link key={p.id} to={`/c/${companyId}/project/${p.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                  {(p.header_image_url || p.main_image_url) && (
                    <img src={p.header_image_url || p.main_image_url!} alt="" className="w-full h-32 object-cover" />
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-sm mb-1 line-clamp-1">{p.title}</h3>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Past Projects */}
      {past.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display font-semibold">Past projects</h2>
            <Badge variant="secondary" className="text-xs">{past.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((p) => (
              <Link key={p.id} to={`/c/${companyId}/project/${p.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full opacity-90">
                  {(p.header_image_url || p.main_image_url) && (
                    <img src={p.header_image_url || p.main_image_url!} alt="" className="w-full h-32 object-cover" />
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-sm mb-1 line-clamp-1">{p.title}</h3>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display font-semibold">Photos</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((ph: any) => (
              <a key={ph.id} href={ph.image_url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={ph.image_url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-muted-foreground">
        Powered by Inlight
      </footer>
    </div>
  );
};

export default PublicCompanyPage;
