import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseProgram, useMyShowcaseProfile } from '@/hooks/useShowcase';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Camera, Film, FileText, CheckCircle } from 'lucide-react';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';
import inlightLogo from '@/assets/inlight-new-logo.png';

const ShowcaseJoinPage: React.FC = () => {
  const { programSlug } = useParams<{ programSlug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: program, isLoading: programLoading } = useShowcaseProgram(programSlug);
  const { profiles, isLoading: profileLoading, upsert, isUpdating } = useMyShowcaseProfile();

  const [bioOverride, setBioOverride] = useState('');
  const [headshotUrl, setHeadshotUrl] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/showcase/join/${programSlug}`);
    }
  }, [authLoading, user, navigate, programSlug]);

  // Check if already joined this program
  useEffect(() => {
    if (profiles.length > 0 && programSlug) {
      const existing = profiles.find(p => p.program_slug === programSlug);
      if (existing) {
        setAlreadyJoined(true);
        setBioOverride(existing.bio_override || '');
        setHeadshotUrl(existing.headshot_url || '');
        setReelUrl(existing.reel_url || '');
        setResumeUrl(existing.resume_url || '');
      }
    }
  }, [profiles, programSlug]);

  const handleFileUpload = async (file: File, type: 'headshot' | 'resume') => {
    if (!user) return;
    setUploading(type);
    try {
      let processedFile = file;
      if (type === 'headshot' && isCompressibleImage(file)) {
        processedFile = await compressImage(file);
      }
      const ext = processedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/showcase-${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(path, processedFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(path);
      if (type === 'headshot') setHeadshotUrl(urlData.publicUrl);
      else setResumeUrl(urlData.publicUrl);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleJoin = async () => {
    if (!programSlug || !program) return;
    await upsert({
      program_name: program.name,
      program_slug: programSlug,
      is_active: true,
      bio_override: bioOverride || null,
      headshot_url: headshotUrl || null,
      reel_url: reelUrl || null,
      resume_url: resumeUrl || null,
    });
    setAlreadyJoined(true);
  };

  if (authLoading || programLoading || profileLoading) {
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
      <header className="py-12 px-6 text-center">
        <img src={inlightLogo} alt="Inlight" className="h-8 mx-auto mb-6 opacity-70" />
        <p className="text-amber-400/80 text-xs uppercase tracking-[0.3em] mb-3 font-medium">
          Join Showcase
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
          {program.name}
        </h1>
        {program.description && (
          <p className="text-white/50 mt-3 max-w-lg mx-auto">{program.description}</p>
        )}
      </header>

      {/* Form */}
      <main className="max-w-lg mx-auto px-6 pb-20">
        {alreadyJoined && (
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 rounded-lg p-4 mb-6">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <p className="text-green-300 text-sm">You're on this showcase! Update your materials below or <button onClick={() => navigate(`/showcase/${programSlug}`)} className="underline text-green-200">view the page</button>.</p>
          </div>
        )}

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-white">Your Showcase Materials</CardTitle>
            <CardDescription className="text-white/50">
              Add your headshot, bio, reel, and resume for casting directors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Headshot */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80">
                <Camera className="w-4 h-4" /> Headshot
              </Label>
              {headshotUrl ? (
                <div className="flex items-center gap-3">
                  <img src={headshotUrl} alt="Headshot" className="w-16 h-20 object-cover rounded-lg border border-white/10" />
                  <Button variant="outline" size="sm" onClick={() => setHeadshotUrl('')} className="border-white/20 text-white/70 hover:text-white">
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild className="border-white/20 text-white/70 hover:text-white">
                    <span>
                      {uploading === 'headshot' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                      Upload Headshot
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'headshot')} />
                </label>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label className="text-white/80">Short Bio</Label>
              <Textarea
                value={bioOverride}
                onChange={(e) => setBioOverride(e.target.value)}
                placeholder="A short bio for casting directors..."
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Reel */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80">
                <Film className="w-4 h-4" /> Demo Reel URL
              </Label>
              <Input
                value={reelUrl}
                onChange={(e) => setReelUrl(e.target.value)}
                placeholder="https://vimeo.com/... or YouTube link"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Resume */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80">
                <FileText className="w-4 h-4" /> Resume PDF
              </Label>
              {resumeUrl ? (
                <div className="flex items-center gap-3">
                  <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 underline">View file</a>
                  <Button variant="outline" size="sm" onClick={() => setResumeUrl('')} className="border-white/20 text-white/70 hover:text-white">
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild className="border-white/20 text-white/70 hover:text-white">
                    <span>
                      {uploading === 'resume' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                      Upload PDF
                    </span>
                  </Button>
                  <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'resume')} />
                </label>
              )}
            </div>

            <Button
              onClick={handleJoin}
              disabled={isUpdating}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {alreadyJoined ? 'Update Materials' : 'Join Showcase'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ShowcaseJoinPage;
