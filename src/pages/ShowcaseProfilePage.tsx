import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Play, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface ShowcaseProfileDetail {
  id: string;
  user_id: string;
  program_name: string;
  program_slug: string;
  headshot_url: string | null;
  reel_url: string | null;
  resume_url: string | null;
  bio_override: string | null;
  display_name?: string;
  stage_name?: string;
  avatar_url?: string;
  role?: string;
  skills?: string[];
}

const useShowcaseProfile = (programSlug: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: ['showcase-profile-detail', programSlug, userId],
    queryFn: async () => {
      if (!programSlug || !userId) return null;

      const { data: sp, error } = await supabase
        .from('showcase_profiles')
        .select('*')
        .eq('program_slug', programSlug)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !sp) return null;

      const { data: profile } = await supabase
        .from('profiles_public')
        .select('display_name, stage_name, avatar_url, role, skills')
        .eq('user_id', userId)
        .single();

      return { ...sp, ...(profile || {}) } as ShowcaseProfileDetail;
    },
    enabled: !!programSlug && !!userId,
  });
};

const ShowcaseProfilePage: React.FC = () => {
  const { programId, userId } = useParams<{ programId: string; userId: string }>();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useShowcaseProfile(programId, userId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-[#0d0202] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-[#0d0202] flex flex-col items-center justify-center text-white gap-4">
        <p className="text-white/50 text-lg">Profile not found.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="border-white/20 text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Showcase
        </Button>
      </div>
    );
  }

  const displayName = profile.stage_name || profile.display_name || 'Student';
  const headshot = profile.headshot_url || profile.avatar_url;

  // Extract video embed URL from reel
  const getEmbedUrl = (url: string): string | null => {
    try {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const id = url.includes('youtu.be')
          ? url.split('youtu.be/')[1]?.split('?')[0]
          : new URL(url).searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.includes('vimeo.com')) {
        const id = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/')[0];
        return id ? `https://player.vimeo.com/video/${id}` : null;
      }
    } catch { /* fallback */ }
    return null;
  };

  const embedUrl = profile.reel_url ? getEmbedUrl(profile.reel_url) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-[#0d0202] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#1a0505]/80 backdrop-blur-md border-b border-rose-900/20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Showcase
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-10 md:gap-14">
          {/* Left column — Headshot */}
          <div className="flex flex-col items-center md:items-start gap-6">
            <div className="w-full max-w-[320px] aspect-[3/4] rounded-xl overflow-hidden bg-black/40 border border-rose-900/30">
              {headshot ? (
                <img src={headshot} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-7xl font-serif">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Right column — Info & materials */}
          <div className="flex flex-col gap-8">
            {/* Name & role */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
                {displayName}
              </h1>
              {profile.role && (
                <p className="text-white/50 text-lg mt-1">{profile.role}</p>
              )}
              <p className="text-rose-300/70 text-xs uppercase tracking-[0.25em] mt-3 font-medium">
                {profile.program_name}
              </p>
            </div>

            {/* Bio */}
            {profile.bio_override && (
              <div>
                <h2 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 font-medium">About</h2>
                <p className="text-white/70 leading-relaxed whitespace-pre-line">{profile.bio_override}</p>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 font-medium">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="text-xs px-3 py-1 rounded-full border border-white/10 text-white/60">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Materials */}
            <div className="flex flex-wrap gap-3 pt-2">
              {profile.reel_url && (
                <a
                  href={profile.reel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700/20 border border-rose-500/30 text-rose-300 text-sm font-medium hover:bg-rose-700/30 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Watch Reel
                </a>
              )}
              {profile.resume_url && (
                <a
                  href={profile.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  View Resume
                </a>
              )}
            </div>

            {/* Embedded reel */}
            {embedUrl && (
              <div>
                <h2 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 font-medium">Reel</h2>
                <div className="aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <iframe
                    src={embedUrl}
                    title={`${displayName}'s Reel`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-rose-900/20 py-8 text-center mt-12">
        <p className="text-white/20 text-xs tracking-widest uppercase">Private Showcase</p>
      </footer>
    </div>
  );
};

export default ShowcaseProfilePage;
