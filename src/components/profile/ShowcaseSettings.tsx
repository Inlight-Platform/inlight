import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyShowcaseProfile } from '@/hooks/useShowcase';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, ExternalLink, Film, FileText, Camera } from 'lucide-react';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';

const ShowcaseSettings: React.FC = () => {
  const { user } = useAuth();
  const { profiles, isLoading, upsert, isUpdating } = useMyShowcaseProfile();

  const [programName, setProgramName] = useState('');
  const [programSlug, setProgramSlug] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [bioOverride, setBioOverride] = useState('');
  const [headshotUrl, setHeadshotUrl] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    if (profiles.length > 0) {
      const p = profiles[0];
      setProgramName(p.program_name);
      setProgramSlug(p.program_slug);
      setIsActive(p.is_active);
      setBioOverride(p.bio_override || '');
      setHeadshotUrl(p.headshot_url || '');
      setReelUrl(p.reel_url || '');
      setResumeUrl(p.resume_url || '');
    }
  }, [profiles]);

  const handleFileUpload = async (file: File, type: 'headshot' | 'reel' | 'resume') => {
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
      else if (type === 'reel') setReelUrl(urlData.publicUrl);
      else setResumeUrl(urlData.publicUrl);

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!programName || !programSlug) {
      toast.error('Program name and slug are required');
      return;
    }
    await upsert({
      program_name: programName,
      program_slug: programSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      is_active: isActive,
      bio_override: bioOverride || null,
      headshot_url: headshotUrl || null,
      reel_url: reelUrl || null,
      resume_url: resumeUrl || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Showcase Profile</CardTitle>
          <CardDescription>
            Manage your presence on the public showcase page. Casting directors can view this without logging in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label>Visible on Showcase</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Program info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Program Name</Label>
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. New Studio on Broadway"
              />
            </div>
            <div className="space-y-2">
              <Label>Program Slug (URL)</Label>
              <Input
                value={programSlug}
                onChange={(e) => setProgramSlug(e.target.value)}
                placeholder="e.g. new-studio-broadway-2026"
              />
              <p className="text-xs text-muted-foreground">
                This creates: /showcase/{programSlug || 'your-slug'}
              </p>
            </div>
          </div>

          {/* Bio override */}
          <div className="space-y-2">
            <Label>Showcase Bio</Label>
            <Textarea
              value={bioOverride}
              onChange={(e) => setBioOverride(e.target.value)}
              placeholder="A short bio for casting directors..."
              rows={3}
            />
          </div>

          {/* Headshot */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> Showcase Headshot
            </Label>
            {headshotUrl ? (
              <div className="flex items-center gap-3">
                <img src={headshotUrl} alt="Headshot" className="w-16 h-20 object-cover rounded-lg border border-border" />
                <Button variant="outline" size="sm" onClick={() => setHeadshotUrl('')}>
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    {uploading === 'headshot' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                    Upload Headshot
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'headshot')}
                />
              </label>
            )}
          </div>

          {/* Reel */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Film className="w-4 h-4" /> Demo Reel URL
            </Label>
            <Input
              value={reelUrl}
              onChange={(e) => setReelUrl(e.target.value)}
              placeholder="https://vimeo.com/... or YouTube link"
            />
          </div>

          {/* Resume */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Resume / Script PDF
            </Label>
            {resumeUrl ? (
              <div className="flex items-center gap-3">
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View file
                </a>
                <Button variant="outline" size="sm" onClick={() => setResumeUrl('')}>
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    {uploading === 'resume' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                    Upload PDF
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'resume')}
                />
              </label>
            )}
          </div>

          <Button onClick={handleSave} disabled={isUpdating} className="w-full">
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Showcase Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShowcaseSettings;
