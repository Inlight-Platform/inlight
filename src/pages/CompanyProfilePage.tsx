import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useCompanyFollows, Company } from '@/hooks/useCompanyFollows';
import { Building2, Globe, MapPin, Users, ChevronLeft, Settings, UserPlus, ChevronDown, Plus, Camera, Loader2, Trash2, FolderKanban, Archive, Image, Sparkles, Palette, X, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ProjectCreator } from '@/components/projects/ProjectCreator';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';
import { CoverImageCropper } from '@/components/profile/CoverImageCropper';
import { AvatarCropper } from '@/components/profile/AvatarCropper';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
};

const getImageContentType = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const extensionType = extension ? IMAGE_MIME_BY_EXTENSION[extension] : undefined;

  if (!file.type || file.type === 'application/octet-stream') {
    return extensionType || 'application/octet-stream';
  }

  return file.type;
};

const sanitizeStorageFileName = (name: string) => {
  const fallback = 'company-image';
  const trimmed = name.trim() || fallback;
  return trimmed
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || fallback;
};

const prepareCompanyImageFile = async (file: File) => {
  if (!getImageContentType(file).startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (isCompressibleImage(file)) {
    return compressImage(file);
  }

  return file;
};

const canCropCompanyImage = (file: File) => {
  const contentType = getImageContentType(file);
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif'].includes(contentType);
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',').pop() || result);
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(blob);
  });

const uploadStaffCompanyMedia = async (
  token: string,
  blob: Blob,
  fileName: string,
  kind: 'logo' | 'cover' | 'photo',
) => {
  const fileBase64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('company-staff-media', {
    body: {
      token,
      kind,
      fileName,
      contentType: blob.type || 'image/jpeg',
      fileBase64,
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { publicUrl: string; photoId?: string | null };
};

// ── Transfer Ownership Dialog ──────────────────────────────────
const TransferOwnershipDialog: React.FC<{ companyId: string; currentOwnerId: string }> = ({ companyId, currentOwnerId }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['transfer-search', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${search}%`)
        .neq('user_id', currentOwnerId)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const transferMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      const { error } = await supabase
        .from('companies')
        .update({ owner_user_id: newOwnerId })
        .eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ownership transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      setOpen(false);
    },
    onError: () => toast.error('Failed to transfer ownership'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Transfer Ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Company Ownership</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Search for a user</Label>
            <Input placeholder="Type a name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {users.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {u.display_name?.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-sm">{u.display_name}</span>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => transferMutation.mutate(u.user_id!)} disabled={transferMutation.isPending}>
                    Transfer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Edit Company Dialog ────────────────────────────────────────
const PALETTE_PRESETS: Array<{ name: string; primary: string; accent: string; text: string }> = [
  { name: 'Sunset Pop',    primary: '#ff6b35', accent: '#ffd23f', text: '#1a1a1a' },
  { name: 'Electric Mint', primary: '#0ea5e9', accent: '#34d399', text: '#0b132b' },
  { name: 'Berry Crush',   primary: '#db2777', accent: '#a855f7', text: '#1a1a1a' },
  { name: 'Studio Noir',   primary: '#111111', accent: '#facc15', text: '#fafafa' },
  { name: 'Coastal',       primary: '#0c2340', accent: '#5cbdb9', text: '#fafafa' },
  { name: 'Peach Cream',   primary: '#f97316', accent: '#fb7185', text: '#1a1a1a' },
];

const EditCompanyDialog: React.FC<{ company: Company; onSaved: () => void; accessToken?: string }> = ({ company, onSaved, accessToken }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || '');
  const [location, setLocation] = useState(company.location || '');
  const [websiteUrl, setWebsiteUrl] = useState(company.website_url || '');
  const [tagline, setTagline] = useState(company.tagline || '');
  const [mission, setMission] = useState(company.mission || '');
  const [primary, setPrimary] = useState(company.brand_primary_color || '#ff6b35');
  const [accent, setAccent] = useState(company.brand_accent_color || '#ffd23f');
  const [textColor, setTextColor] = useState(company.brand_text_color || '#1a1a1a');
  const [funFacts, setFunFacts] = useState<string[]>(
    Array.isArray(company.fun_facts) ? company.fun_facts : []
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [coverUrl, setCoverUrl] = useState(company.cover_image_url || '');
  const [logoCropperOpen, setLogoCropperOpen] = useState(false);
  const [logoCropperImageSrc, setLogoCropperImageSrc] = useState('');
  const [coverCropperOpen, setCoverCropperOpen] = useState(false);
  const [coverCropperImageSrc, setCoverCropperImageSrc] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File, kind: 'logo' | 'cover') => {
    const imageFile = await prepareCompanyImageFile(file);
    if (accessToken) {
      const uploaded = await uploadStaffCompanyMedia(accessToken, imageFile, imageFile.name, kind);
      return uploaded.publicUrl;
    }
    if (!user?.id) throw new Error('You need to be signed in to upload images.');
    const path = `${user.id}/companies/${company.id}/${kind}-${Date.now()}-${sanitizeStorageFileName(imageFile.name)}`;
    const { error } = await supabase.storage.from('profile-media').upload(path, imageFile, {
      contentType: getImageContentType(imageFile),
    });
    if (error) throw error;
    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadCroppedCover = async (blob: Blob) => {
    if (accessToken) {
      const uploaded = await uploadStaffCompanyMedia(accessToken, blob, 'cover-cropped.jpg', 'cover');
      setCoverUrl(`${uploaded.publicUrl}?t=${Date.now()}`);
      toast.success('Cover cropped');
      return;
    }
    if (!user?.id) throw new Error('You need to be signed in to upload images.');
    const path = `${user.id}/companies/${company.id}/cover-${Date.now()}-cropped.jpg`;
    const { error } = await supabase.storage.from('profile-media').upload(path, blob, {
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    setCoverUrl(`${data.publicUrl}?t=${Date.now()}`);
    toast.success('Cover cropped');
  };

  const uploadCroppedLogo = async (blob: Blob) => {
    if (accessToken) {
      const uploaded = await uploadStaffCompanyMedia(accessToken, blob, 'logo-cropped.jpg', 'logo');
      setLogoUrl(`${uploaded.publicUrl}?t=${Date.now()}`);
      toast.success('Logo cropped');
      return;
    }
    if (!user?.id) throw new Error('You need to be signed in to upload images.');
    const path = `${user.id}/companies/${company.id}/logo-${Date.now()}-cropped.jpg`;
    const { error } = await supabase.storage.from('profile-media').upload(path, blob, {
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
    toast.success('Logo cropped');
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }

    if (canCropCompanyImage(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoCropperImageSrc(reader.result as string);
        setLogoCropperOpen(true);
      };
      reader.onerror = () => toast.error('Could not read logo image');
      reader.readAsDataURL(file);
      return;
    }

    setLogoUploading(true);
    try {
      const url = await uploadImage(file, 'logo');
      setLogoUrl(url);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }

    if (canCropCompanyImage(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        setCoverCropperImageSrc(reader.result as string);
        setCoverCropperOpen(true);
      };
      reader.onerror = () => toast.error('Could not read cover image');
      reader.readAsDataURL(file);
      return;
    }

    setCoverUploading(true);
    try {
      const url = await uploadImage(file, 'cover');
      setCoverUrl(url);
      toast.success('Cover uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Cover upload failed');
    } finally {
      setCoverUploading(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const cleanedFacts = funFacts.map(f => f.trim()).filter(Boolean);
      if (accessToken) {
        const { error } = await (supabase.rpc as any)('update_company_with_staff_token', {
          _token: accessToken,
          _name: name,
          _description: description || null,
          _location: location || null,
          _website_url: websiteUrl || null,
          _tagline: tagline || null,
          _mission: mission || null,
          _brand_primary_color: primary || null,
          _brand_accent_color: accent || null,
          _brand_text_color: textColor || null,
          _logo_url: logoUrl || null,
          _cover_image_url: coverUrl || null,
          _fun_facts: cleanedFacts,
        });
        if (error) throw error;
        return;
      }
      const updatePayload: Record<string, unknown> = {
        name,
        description: description || null,
        location: location || null,
        website_url: websiteUrl || null,
        tagline: tagline || null,
        mission: mission || null,
        brand_primary_color: primary || null,
        brand_accent_color: accent || null,
        brand_text_color: textColor || null,
        logo_url: logoUrl || null,
        cover_image_url: coverUrl || null,
        fun_facts: cleanedFacts,
      };
      const { error } = await supabase
        .from('companies')
        .update(updatePayload as never)
        .eq('id', company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Company updated');
      queryClient.invalidateQueries({ queryKey: ['company', company.id] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onSaved();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update company'),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Customize Page
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Customize Your Company Page</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Identity */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h3>
            <div><Label>Company name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Tagline <span className="text-xs text-muted-foreground">— short & punchy</span></Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Where stories meet the stage." />
            </div>
            <div><Label>Short description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
            <div><Label>Mission / About</Label><Textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={4} placeholder="Tell the world what you stand for..." /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
              <div><Label>Website</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
          </div>

          {/* Imagery */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Imagery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
                    {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-1" /> : <Building2 className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                      {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />} Upload
                    </Button>
                    {logoUrl && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setLogoUrl('')} disabled={logoUploading}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label>Cover banner</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-24 h-16 rounded-md bg-muted overflow-hidden flex items-center justify-center border">
                    {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-contain" /> : <Image className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}>
                      {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />} Upload
                    </Button>
                    {coverUrl && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCoverUrl('')} disabled={coverUploading}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Raster logo and banner uploads open a cropper before they are saved. SVG and GIF files upload directly.
            </p>
          </div>

          {/* Palette */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" /> Color palette
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PALETTE_PRESETS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { setPrimary(p.primary); setAccent(p.accent); setTextColor(p.text); }}
                  className="rounded-lg p-3 text-left border border-border hover:scale-[1.02] transition-transform"
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})`, color: p.text }}
                >
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="flex gap-1 mt-2">
                    <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: p.primary }} />
                    <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: p.accent }} />
                    <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: p.text }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Primary</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                  <Input value={primary} onChange={e => setPrimary(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Accent</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                  <Input value={accent} onChange={e => setAccent(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Text on hero</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                  <Input value={textColor} onChange={e => setTextColor(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Fun facts */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fun facts</h3>
            <p className="text-xs text-muted-foreground">Quick blurbs that show up as colorful cards on your page.</p>
            {funFacts.map((fact, i) => (
              <div key={i} className="flex gap-2">
                <Input value={fact} onChange={e => {
                  const next = [...funFacts]; next[i] = e.target.value; setFunFacts(next);
                }} placeholder={`Fun fact #${i + 1}`} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setFunFacts(funFacts.filter((_, idx) => idx !== i))}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {funFacts.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setFunFacts([...funFacts, ''])}>
                <Plus className="w-4 h-4 mr-1" /> Add fun fact
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>

        </DialogContent>
      </Dialog>

      <CoverImageCropper
        open={coverCropperOpen}
        imageSrc={coverCropperImageSrc}
        onClose={() => setCoverCropperOpen(false)}
        onCropComplete={async (blob) => {
          setCoverUploading(true);
          try {
            await uploadCroppedCover(blob);
          } catch (err: any) {
            toast.error(err.message || 'Cover crop failed');
            throw err;
          } finally {
            setCoverUploading(false);
          }
        }}
      />
      <AvatarCropper
        open={logoCropperOpen}
        imageSrc={logoCropperImageSrc}
        onClose={() => setLogoCropperOpen(false)}
        title="Crop Company Logo"
        saveLabel="Save Logo"
        onCropComplete={async (blob) => {
          setLogoUploading(true);
          try {
            await uploadCroppedLogo(blob);
          } catch (err: any) {
            toast.error(err.message || 'Logo crop failed');
            throw err;
          } finally {
            setLogoUploading(false);
          }
        }}
      />
    </>
  );
};

// ── Add Project to Company Dialog ──────────────────────────────
const AddProjectDialog: React.FC<{ companyId: string; status: 'active' | 'archived'; onAdded: () => void }> = ({ companyId, status, onAdded }) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's projects that aren't already linked to this company
  const { data: availableProjects = [] } = useQuery({
    queryKey: ['user-projects-unlinked', user?.id, companyId],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status')
        .eq('creator_id', user.id)
        .is('company_id', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  const linkMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const newStatus = status === 'archived' ? 'archived' : 'active';
      const { error } = await supabase
        .from('projects')
        .update({ company_id: companyId, status: newStatus })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Project linked to company');
      queryClient.invalidateQueries({ queryKey: ['company-projects', companyId] });
      onAdded();
      setOpen(false);
    },
    onError: () => toast.error('Failed to link project'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {status === 'archived' ? 'Past' : 'Current'} Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No available projects to link.</p>
          ) : (
            availableProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <span className="font-medium text-sm">{p.title}</span>
                <Button size="sm" onClick={() => linkMutation.mutate(p.id)} disabled={linkMutation.isPending}>
                  Link
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Page Component ────────────────────────────────────────
const CompanyProfilePage: React.FC = () => {
  const { companyId: routeCompanyId, token: staffToken } = useParams<{ companyId?: string; token?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const { isFollowingCompany, followCompany, unfollowCompany } = useCompanyFollows();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Collapsible states
  const [currentProjectsOpen, setCurrentProjectsOpen] = useState(true);
  const [pastProjectsOpen, setPastProjectsOpen] = useState(true);
  const [photosOpen, setPhotosOpen] = useState(true);

  const { data: staffAccess, isLoading: staffAccessLoading, isError: staffAccessError } = useQuery({
    queryKey: ['company-staff-access', staffToken],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('validate_company_staff_access', {
        _token: staffToken,
      });
      if (error) throw error;
      return (data || [])[0] as { company_id: string; email: string; staff_name: string | null } | undefined;
    },
    enabled: !!staffToken,
    retry: false,
  });

  const companyId = routeCompanyId || staffAccess?.company_id;

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', companyId!).single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!companyId,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['company-follower-count', companyId],
    queryFn: async () => {
      const { count, error } = await supabase.from('company_follows').select('*', { count: 'exact', head: true }).eq('company_id', companyId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ['company-owner', company?.owner_user_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles_public').select('user_id, display_name, avatar_url, role').eq('user_id', company!.owner_user_id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!company?.owner_user_id,
  });

  const { data: invitedStaff = [] } = useQuery({
    queryKey: ['company-invited-staff', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_company_staff_access_public', { _company_id: companyId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch company projects
  const { data: companyProjects = [] } = useQuery({
    queryKey: ['company-projects', companyId],
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

  // Fetch company photos
  const { data: companyPhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['company-photos', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_photos')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const isOwner = user?.id === company?.owner_user_id;
  const hasStaffAccess = !!staffToken && !!staffAccess && staffAccess.company_id === company?.id;
  const canManageCompany = isOwner || isAdmin || hasStaffAccess;
  const canManageProjects = isOwner || isAdmin;
  const following = companyId ? isFollowingCompany(companyId) : false;

  const normalizeStatus = (s: string | null): string => {
    const map: Record<string, string> = { 'pre-production': 'planning', 'in-production': 'active', 'post-production': 'wrapping', 'completed': 'archived' };
    return map[s?.toLowerCase() || ''] || s || 'planning';
  };

  const currentProjects = companyProjects.filter(p => normalizeStatus(p.status) !== 'archived');
  const pastProjects = companyProjects.filter(p => normalizeStatus(p.status) === 'archived');

  const brandPrimary = company?.brand_primary_color || '#ff6b35';
  const brandAccent = company?.brand_accent_color || '#ffd23f';
  const brandText = company?.brand_text_color || '#1a1a1a';
  const funFacts: string[] = Array.isArray(company?.fun_facts) ? (company!.fun_facts as string[]) : [];

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingPhoto(true);
    try {
      const imageFile = await prepareCompanyImageFile(file);
      if (staffToken) {
        await uploadStaffCompanyMedia(staffToken, imageFile, imageFile.name, 'photo');
        toast.success('Photo uploaded!');
        refetchPhotos();
        return;
      }
      if (!user?.id) throw new Error('You need to be signed in to upload images.');
      const fileName = `${user.id}/companies/${companyId}/${Date.now()}-${sanitizeStorageFileName(imageFile.name)}`;
      const { error: uploadError } = await supabase.storage.from('profile-media').upload(fileName, imageFile, {
        contentType: getImageContentType(imageFile),
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
      const { error: insertError } = await supabase.from('company_photos').insert({ company_id: companyId, image_url: urlData.publicUrl, uploaded_by: user.id });
      if (insertError) throw insertError;
      toast.success('Photo uploaded!');
      refetchPhotos();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      if (staffToken) {
        const { error } = await (supabase.rpc as any)('delete_company_photo_with_staff_token', {
          _token: staffToken,
          _photo_id: photoId,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('company_photos').delete().eq('id', photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Photo deleted');
      refetchPhotos();
    },
    onError: () => toast.error('Failed to delete photo'),
  });

  const unlinkProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from('projects').update({ company_id: null }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Project unlinked');
      queryClient.invalidateQueries({ queryKey: ['company-projects', companyId] });
    },
    onError: () => toast.error('Failed to unlink project'),
  });

  if (isLoading || staffAccessLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[200px] sm:h-[280px] bg-muted animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (staffToken && (staffAccessError || !staffAccess)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">This company edit link is invalid or expired.</p>
        <Button variant="ghost" onClick={() => navigate('/people')} className="mt-4">Back to People</Button>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="ghost" onClick={() => navigate('/people')} className="mt-4">Back to People</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button - matches personal profile */}
      <button
        onClick={() => safeBack(navigate, '/people')}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm shadow-card hover:bg-accent transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Cover / Hero - matches personal profile sizing */}
      <header className="relative">
        <div className="relative h-[200px] sm:h-[280px] md:h-[350px] lg:h-[450px] overflow-hidden">
          {company.cover_image_url ? (
            <img src={company.cover_image_url} alt="" className="w-full h-full object-contain" style={{ background: `linear-gradient(135deg, ${brandPrimary}22, ${brandAccent}22)` }} />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
          {/* playful decorative blobs */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-40 blur-3xl" style={{ background: brandAccent }} />
          <div className="absolute bottom-10 left-1/3 w-32 h-32 rounded-full opacity-30 blur-3xl" style={{ background: brandPrimary }} />
        </div>

        {/* Company info - matches personal profile avatar offset */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          {/* Logo/Avatar */}
          <div className="absolute -top-16 sm:-top-20 left-4 sm:left-6 lg:left-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-[120px] lg:h-[120px] rounded-full border-4 border-background bg-card flex items-center justify-center shadow-card overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-2" />
              ) : (
                <Building2 className="w-10 h-10 text-primary" />
              )}
            </div>
          </div>

          {/* Name and meta */}
          <div className="pt-12 sm:pt-16 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
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
                <p className="mt-1 text-base sm:text-lg font-medium text-foreground/90 italic">
                  "{company.tagline}"
                </p>
              )}
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                {company.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {company.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {followerCount} follower{followerCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {canManageCompany && companyId && (
                <Button
                  variant="outline"
                  className="rounded-full gap-2"
                  onClick={() => {
                    const url = `${window.location.origin}/c/${companyId}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Public link copied');
                  }}
                >
                  <LinkIcon className="w-4 h-4" />
                  Copy public link
                </Button>
              )}
              {!canManageCompany && companyId && (
                <Button
                  variant={following ? 'outline' : 'default'}
                  className="rounded-full"
                  onClick={() => following ? unfollowCompany.mutate(companyId) : followCompany.mutate(companyId)}
                >
                  {following ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Description */}
      {company.description && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
          <p className="text-foreground">{company.description}</p>
        </section>
      )}

      {/* Mission */}
      {company.mission && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div
            className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brandPrimary}15, ${brandAccent}15)`, border: `1px solid ${brandPrimary}30` }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: brandAccent }} />
            <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: brandPrimary }}>Our Mission</h2>
            <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap relative">{company.mission}</p>
          </div>
        </section>
      )}

      {/* Fun Facts */}
      {funFacts.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: brandPrimary }} />
            <h2 className="text-lg font-display font-semibold">Fun facts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {funFacts.map((fact, i) => {
              const tints = [
                `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`,
                `linear-gradient(135deg, ${brandAccent}, ${brandPrimary})`,
                `linear-gradient(135deg, ${brandPrimary}cc, ${brandAccent}cc)`,
              ];
              return (
                <div
                  key={i}
                  className="rounded-2xl p-5 shadow-card transform hover:-translate-y-1 transition-transform"
                  style={{ background: tints[i % tints.length], color: brandText }}
                >
                  <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">#{i + 1}</div>
                  <p className="font-medium leading-snug">{fact}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Website */}
      {company.website_url && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
              {company.website_url}
            </a>
          </div>
        </section>
      )}

      {/* Staff Section - only visible to owner */}
      {canManageCompany && (ownerProfile || invitedStaff.length > 0) && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
          <h2 className="text-lg font-display font-semibold mb-3">Staff</h2>
          <div className="space-y-2">
            {ownerProfile && (
              <div
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/profile/${ownerProfile.user_id}`)}
              >
                {ownerProfile.avatar_url ? (
                  <img src={ownerProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {ownerProfile.display_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{ownerProfile.display_name}</p>
                  <p className="text-xs text-muted-foreground">{ownerProfile.role || 'Owner'}</p>
                </div>
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Owner</span>
              </div>
            )}
            {invitedStaff.map((staff: any) => {
              const displayName = staff.staff_name || staff.email;
              return (
                <div key={`${staff.email}-${displayName}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {(displayName || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{staff.staff_name ? staff.email : 'Staff editor'}</p>
                  </div>
                  <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">Editor</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Current Projects - Collapsible */}
      <Collapsible open={currentProjectsOpen} onOpenChange={setCurrentProjectsOpen} className="border-b border-border">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-semibold">Current Projects</h2>
              {currentProjects.length > 0 && (
                <Badge variant="secondary" className="text-xs">{currentProjects.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canManageProjects && currentProjectsOpen && (
                <AddProjectDialog companyId={company.id} status="active" onAdded={() => queryClient.invalidateQueries({ queryKey: ['company-projects', companyId] })} />
              )}
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${currentProjectsOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            {currentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No current projects.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentProjects.map((project) => (
                  <Card key={project.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border" onClick={() => navigate(`/projects/${project.id}`)}>
                    {project.header_image_url || project.main_image_url ? (
                      <img src={project.header_image_url || project.main_image_url} alt={project.title} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <FolderKanban className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground text-sm line-clamp-1">{project.title}</h3>
                        {canManageProjects && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); unlinkProjectMutation.mutate(project.id); }}>
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* Past Projects - Collapsible */}
      <Collapsible open={pastProjectsOpen} onOpenChange={setPastProjectsOpen} className="border-b border-border">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-semibold">Past Projects</h2>
              {pastProjects.length > 0 && (
                <Badge variant="secondary" className="text-xs">{pastProjects.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canManageProjects && pastProjectsOpen && (
                <AddProjectDialog companyId={company.id} status="archived" onAdded={() => queryClient.invalidateQueries({ queryKey: ['company-projects', companyId] })} />
              )}
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${pastProjectsOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            {pastProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No past projects.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastProjects.map((project) => (
                  <Card key={project.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border" onClick={() => navigate(`/projects/${project.id}`)}>
                    {project.header_image_url || project.main_image_url ? (
                      <img src={project.header_image_url || project.main_image_url} alt={project.title} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <FolderKanban className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground text-sm line-clamp-1">{project.title}</h3>
                        {canManageProjects && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); unlinkProjectMutation.mutate(project.id); }}>
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* Photos - Collapsible */}
      <Collapsible open={photosOpen} onOpenChange={setPhotosOpen}>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between w-full gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 group text-left">
              <Image className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-semibold">Photos</h2>
              {companyPhotos.length > 0 && (
                <Badge variant="secondary" className="text-xs">{companyPhotos.length}</Badge>
              )}
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ml-auto ${photosOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            {canManageCompany && photosOpen && (
              <>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add
                </Button>
              </>
            )}
          </div>
          <CollapsibleContent className="mt-4">
            {companyPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No photos yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {companyPhotos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square">
                    <img src={photo.image_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                    {canManageCompany && (
                      <button
                        onClick={() => deletePhotoMutation.mutate(photo.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* Owner Controls */}
      {canManageCompany && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-border">
          <h2 className="text-lg font-display font-semibold mb-3">Manage Company</h2>
          <div className="flex flex-wrap gap-3">
            <EditCompanyDialog company={company} accessToken={staffToken} onSaved={() => queryClient.invalidateQueries({ queryKey: ['company', companyId] })} />
            {canManageProjects && company.owner_user_id && (
              <TransferOwnershipDialog companyId={company.id} currentOwnerId={company.owner_user_id} />
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default CompanyProfilePage;
