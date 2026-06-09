import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFollows, Company } from '@/hooks/useCompanyFollows';
import { Building2, Globe, MapPin, Users, ChevronLeft, Settings, UserPlus, ChevronDown, Plus, Camera, Loader2, Trash2, FolderKanban, Archive, Image } from 'lucide-react';
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
const EditCompanyDialog: React.FC<{ company: Company; onSaved: () => void }> = ({ company, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || '');
  const [location, setLocation] = useState(company.location || '');
  const [websiteUrl, setWebsiteUrl] = useState(company.website_url || '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('companies')
        .update({ name, description: description || null, location: location || null, website_url: websiteUrl || null })
        .eq('id', company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Company updated');
      onSaved();
      setOpen(false);
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Edit Company
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><Label>Website URL</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isFollowingCompany, followCompany, unfollowCompany } = useCompanyFollows();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Collapsible states
  const [currentProjectsOpen, setCurrentProjectsOpen] = useState(true);
  const [pastProjectsOpen, setPastProjectsOpen] = useState(true);
  const [photosOpen, setPhotosOpen] = useState(true);

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
  const following = companyId ? isFollowingCompany(companyId) : false;

  const normalizeStatus = (s: string | null): string => {
    const map: Record<string, string> = { 'pre-production': 'planning', 'in-production': 'active', 'post-production': 'wrapping', 'completed': 'archived' };
    return map[s?.toLowerCase() || ''] || s || 'planning';
  };

  const currentProjects = companyProjects.filter(p => normalizeStatus(p.status) !== 'archived');
  const pastProjects = companyProjects.filter(p => normalizeStatus(p.status) === 'archived');

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !companyId) return;
    setUploadingPhoto(true);
    try {
      const fileName = `companies/${companyId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('profile-media').upload(fileName, file, { contentType: file.type });
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

  if (isLoading) {
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
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>

        {/* Company info - matches personal profile avatar offset */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          {/* Logo/Avatar */}
          <div className="absolute -top-16 sm:-top-20 left-4 sm:left-6 lg:left-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-[120px] lg:h-[120px] rounded-full border-4 border-background bg-card flex items-center justify-center shadow-card overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-primary" />
              )}
            </div>
          </div>

          {/* Name and meta */}
          <div className="pt-12 sm:pt-16 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold">{company.name}</h1>
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
              {!isOwner && companyId && (
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
      {isOwner && ownerProfile && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
          <h2 className="text-lg font-display font-semibold mb-3">Staff</h2>
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
              {isOwner && currentProjectsOpen && (
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
                        {isOwner && (
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
              {isOwner && pastProjectsOpen && (
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
                        {isOwner && (
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
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-semibold">Photos</h2>
              {companyPhotos.length > 0 && (
                <Badge variant="secondary" className="text-xs">{companyPhotos.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && photosOpen && (
                <>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }} disabled={uploadingPhoto}>
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add
                  </Button>
                </>
              )}
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${photosOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            {companyPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No photos yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {companyPhotos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square">
                    <img src={photo.image_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                    {isOwner && (
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
      {isOwner && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-border">
          <h2 className="text-lg font-display font-semibold mb-3">Manage Company</h2>
          <div className="flex flex-wrap gap-3">
            <EditCompanyDialog company={company} onSaved={() => queryClient.invalidateQueries({ queryKey: ['company', companyId] })} />
            <TransferOwnershipDialog companyId={company.id} currentOwnerId={company.owner_user_id!} />
          </div>
        </section>
      )}
    </div>
  );
};

export default CompanyProfilePage;
