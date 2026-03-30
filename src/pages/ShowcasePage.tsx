import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShowcaseByProgram, useShowcaseProgram, ShowcaseProfile } from '@/hooks/useShowcase';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ShowcaseStudentCard: React.FC<{ profile: ShowcaseProfile; onViewProfile: (userId: string) => void }> = ({ profile, onViewProfile }) => {
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.stage_name || profile.display_name || 'Student';
  const headshot = profile.headshot_url || profile.avatar_url;

  return (
    <div
      className="group relative overflow-hidden rounded-xl bg-black/40 border border-rose-900/30 backdrop-blur-sm hover:border-rose-700/50 transition-all duration-500 cursor-pointer"
      onClick={() => onViewProfile(profile.user_id)}
    >
      <div className="aspect-[3/4] overflow-hidden bg-black/60">
        {headshot ? (
          <img
            src={headshot}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-5xl font-display">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#2a0a0a]/95 via-black/20 to-transparent pointer-events-none" />

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-semibold text-lg tracking-wide">{displayName}</h3>
        {profile.role && (
          <p className="text-white/60 text-sm mt-0.5">{profile.role}</p>
        )}
        {profile.bio_override && (
          <p className="text-white/50 text-xs mt-2 line-clamp-2">{profile.bio_override}</p>
        )}

        <div className="flex gap-2 mt-3">
          {profile.reel_url && (
            <span className="text-[10px] uppercase tracking-widest text-rose-300/80 border border-rose-400/30 px-2 py-0.5 rounded-full">
              Reel
            </span>
          )}
          {profile.resume_url && (
            <span className="text-[10px] uppercase tracking-widest text-rose-300/80 border border-rose-400/30 px-2 py-0.5 rounded-full">
              Resume
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const ShowcasePage: React.FC = () => {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { data: students, isLoading } = useShowcaseByProgram(programId);
  const { data: program } = useShowcaseProgram(programId);

  const handleViewProfile = (userId: string) => {
    navigate(`/showcase/${programId}/${userId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const programName = program?.name || programId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Showcase';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Cinematic header */}
      <header className="relative py-16 px-6 text-center overflow-hidden">
        {/* Background grain */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/8 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <img src={inlightLogo} alt="Inlight" className="h-10 mx-auto mb-8 opacity-70" />
          <p className="text-amber-400/80 text-xs uppercase tracking-[0.3em] mb-4 font-medium">
            Private Showcase
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: "'Georgia', serif" }}>
            {programName}
            <span className="block text-2xl md:text-3xl font-normal text-white/60 mt-2">Class of 2026</span>
          </h1>
          {program?.description && (
            <p className="text-white/50 text-lg max-w-xl mx-auto mt-4">{program.description}</p>
          )}
          <div className="w-16 h-px bg-amber-400/40 mx-auto mt-8" />
        </div>
      </header>

      {/* Student grid */}
      <main className="max-w-7xl mx-auto px-6 pb-20">
        {(!students || students.length === 0) ? (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">No students in this showcase yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {students.map((student) => (
              <ShowcaseStudentCard
                key={student.id}
                profile={student}
                onViewProfile={handleViewProfile}
              />
            ))}
          </div>
        )}
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-white/20 text-xs tracking-widest uppercase">
          Powered by Inlight
        </p>
      </footer>
    </div>
  );
};

export default ShowcasePage;
