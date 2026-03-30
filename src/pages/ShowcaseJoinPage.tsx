import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseByProgram, useShowcaseProgram, useMyShowcaseProfile, ShowcaseProfile } from '@/hooks/useShowcase';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';
import inlightLogo from '@/assets/inlight-new-logo.png';

/* ─── Inline Auth Form ─── */
const InlineAuth: React.FC<{ programSlug: string }> = ({ programSlug }) => {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, displayName || undefined);
        if (error) throw error;
        toast.success('Account created! Check your email to verify, then log in.');
        setMode('login');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 px-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'signup' ? 'Create Your Account' : 'Sign In'}
          </h2>
          <p className="text-white/50 text-sm mt-1">
            {mode === 'signup'
              ? 'Create an account to add your profile to this showcase.'
              : 'Sign in to manage your showcase profile.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <Label className="text-white/80">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          )}
          <div>
            <Label className="text-white/80">Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <Label className="text-white/80">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-white/40 text-sm">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-amber-400 underline">Sign in</button>
            </>
          ) : (
            <>Need an account?{' '}
              <button onClick={() => setMode('signup')} className="text-amber-400 underline">Sign up</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

/* ─── Add Profile Dialog ─── */
const AddProfileDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programSlug: string;
  programName: string;
  existingProfile?: ShowcaseProfile | null;
}> = ({ open, onOpenChange, programSlug, programName, existingProfile }) => {
  const { user } = useAuth();
  const { upsert, isUpdating } = useMyShowcaseProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [headshotUrl, setHeadshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      setFirstName(existingProfile.first_name || '');
      setLastName(existingProfile.last_name || '');
      setBio(existingProfile.bio_override || '');
      setReelUrl(existingProfile.reel_url || '');
      setResumeUrl(existingProfile.resume_url || '');
      setHeadshotUrl(existingProfile.headshot_url || '');
    }
  }, [existingProfile]);

  const handleHeadshotUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      let processedFile = file;
      if (isCompressibleImage(file)) {
        processedFile = await compressImage(file);
      }
      const ext = processedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/showcase-headshot-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('profile-media')
        .upload(path, processedFile, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(path);
      setHeadshotUrl(urlData.publicUrl);
      toast.success('Headshot uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const allFieldsFilled = firstName.trim() && lastName.trim() && bio.trim() && reelUrl.trim() && resumeUrl.trim() && headshotUrl;

  const handleSave = async () => {
    if (!allFieldsFilled) {
      toast.error('Please fill out all 6 fields before submitting.');
      return;
    }
    await upsert({
      program_name: programName,
      program_slug: programSlug,
      is_active: true,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      bio_override: bio.trim(),
      reel_url: reelUrl.trim(),
      resume_url: resumeUrl.trim(),
      headshot_url: headshotUrl,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {existingProfile ? 'Edit Your Profile' : 'Add Your Profile'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Headshot */}
          <div>
            <Label className="text-white/80">Headshot *</Label>
            {headshotUrl ? (
              <div className="flex items-center gap-3 mt-1">
                <img src={headshotUrl} alt="Headshot" className="w-16 h-20 object-cover rounded-lg border border-white/10" />
                <Button variant="outline" size="sm" onClick={() => setHeadshotUrl('')} className="border-white/20 text-white/70 hover:text-white">
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block mt-1">
                <Button variant="outline" size="sm" asChild className="border-white/20 text-white/70 hover:text-white">
                  <span>
                    {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                    Upload Headshot
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleHeadshotUpload(e.target.files[0])} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/80">First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div>
              <Label className="text-white/80">Last Name *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
          </div>

          <div>
            <Label className="text-white/80">Bio *</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio for casting directors..." rows={3} className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div>
            <Label className="text-white/80">Demo Reel URL *</Label>
            <Input value={reelUrl} onChange={(e) => setReelUrl(e.target.value)} placeholder="https://vimeo.com/..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div>
            <Label className="text-white/80">Resume Link *</Label>
            <Input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://drive.google.com/..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <Button
            onClick={handleSave}
            disabled={isUpdating || !allFieldsFilled}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existingProfile ? 'Update Profile' : 'Add Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Student Card (reused from ShowcasePage style) ─── */
const EditableStudentCard: React.FC<{ profile: ShowcaseProfile; isOwn?: boolean; onClick?: () => void }> = ({ profile, isOwn, onClick }) => {
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || 'Student';
  const headshot = profile.headshot_url || profile.avatar_url;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-black/40 border border-white/10 backdrop-blur-sm hover:border-white/25 transition-all duration-500 cursor-pointer" onClick={onClick}>
      {isOwn && (
        <div className="absolute top-2 right-2 z-10 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
          Edit
        </div>
      )}
      <div className="aspect-[3/4] overflow-hidden bg-black/60">
        {headshot ? (
          <img src={headshot} alt={displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-5xl font-display">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-semibold text-lg tracking-wide">{displayName}</h3>
        {profile.bio_override && <p className="text-white/50 text-xs mt-2 line-clamp-2">{profile.bio_override}</p>}
        <div className="flex gap-2 mt-3">
          {profile.reel_url && <span className="text-[10px] uppercase tracking-widest text-amber-400/80 border border-amber-400/30 px-2 py-0.5 rounded-full">Reel</span>}
          {profile.resume_url && <span className="text-[10px] uppercase tracking-widest text-amber-400/80 border border-amber-400/30 px-2 py-0.5 rounded-full">Resume</span>}
        </div>
      </div>
    </div>
  );
};

/* ─── Main Page ─── */
const ShowcaseJoinPage: React.FC = () => {
  const { programSlug } = useParams<{ programSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: program, isLoading: programLoading } = useShowcaseProgram(programSlug);
  const { data: students, isLoading: studentsLoading } = useShowcaseByProgram(programSlug);
  const { profiles } = useMyShowcaseProfile();
  const [dialogOpen, setDialogOpen] = useState(false);

  const myProfile = profiles.find(p => p.program_slug === programSlug) || null;
  const programName = program?.name || programSlug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Showcase';

  if (authLoading || programLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/50">
        <p>Program not found or no longer active.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="relative py-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/8 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <img src={inlightLogo} alt="Inlight" className="h-10 mx-auto mb-8 opacity-70" />
          <p className="text-amber-400/80 text-xs uppercase tracking-[0.3em] mb-4 font-medium">Private Showcase</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: "'Georgia', serif" }}>
            {programName}
            <span className="block text-2xl md:text-3xl font-normal text-white/60 mt-2">Class of 2026</span>
          </h1>
          {program.description && <p className="text-white/50 text-lg max-w-xl mx-auto mt-4">{program.description}</p>}
          <div className="w-16 h-px bg-amber-400/40 mx-auto mt-8" />
        </div>

        {/* Add Your Profile button - only when logged in */}
        {user && (
          <div className="absolute top-6 right-6 z-20">
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              {myProfile ? 'Edit Your Profile' : 'Add Your Profile'}
            </Button>
          </div>
        )}
      </header>

      {/* If not logged in, show auth */}
      {!user && <InlineAuth programSlug={programSlug || ''} />}

      {/* Student grid */}
      <main className="max-w-7xl mx-auto px-6 pb-20">
        {studentsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        ) : (!students || students.length === 0) ? (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">No students in this showcase yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {students.map((student) => (
              <EditableStudentCard
                key={student.id}
                profile={student}
                isOwn={!!user && student.user_id === user.id}
                onClick={() => {
                  if (user && student.user_id === user.id) {
                    setDialogOpen(true);
                  } else {
                    navigate(`/showcase/${programSlug}/${student.user_id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-white/20 text-xs tracking-widest uppercase">Powered by Inlight</p>
      </footer>

      {/* Add/Edit Dialog */}
      {user && (
        <AddProfileDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          programSlug={programSlug || ''}
          programName={programName}
          existingProfile={myProfile}
        />
      )}
    </div>
  );
};

export default ShowcaseJoinPage;
