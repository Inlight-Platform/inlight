import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFollows, Company } from '@/hooks/useCompanyFollows';
import { Building2, Globe, MapPin, Users, ArrowLeft, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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
            <Input
              placeholder="Type a name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {users.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
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
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => transferMutation.mutate(u.user_id!)}
                    disabled={transferMutation.isPending}
                  >
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
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>Website URL</Label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CompanyProfilePage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isFollowingCompany, followCompany, unfollowCompany } = useCompanyFollows();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!companyId,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ['company-follower-count', companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('company_follows')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ['company-owner', company?.owner_user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, role')
        .eq('user_id', company!.owner_user_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!company?.owner_user_id,
  });

  const isOwner = user?.id === company?.owner_user_id;
  const following = companyId ? isFollowingCompany(companyId) : false;

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="ghost" onClick={() => navigate('/people')} className="mt-4">
          Back to People
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div
        className="h-40 sm:h-56 w-full relative"
        style={{
          background: 'linear-gradient(135deg, hsl(200 80% 50%), hsl(220 70% 45%))',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/50 backdrop-blur-sm hover:bg-background/70"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 -mt-12 pb-12">
        {/* Logo + Name */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="w-24 h-24 rounded-2xl bg-card border-4 border-background flex items-center justify-center shadow-lg">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <Building2 className="w-10 h-10 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">{company.name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
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

        {/* Description */}
        {company.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-foreground">{company.description}</p>
            </CardContent>
          </Card>
        )}

        {company.website_url && (
          <Card className="mb-6">
            <CardContent className="pt-6 flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                {company.website_url}
              </a>
            </CardContent>
          </Card>
        )}

        {/* Staff Section - only visible to owner */}
        {isOwner && ownerProfile && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Staff</CardTitle>
            </CardHeader>
            <CardContent>
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
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                  Owner
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Owner Controls */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manage Company</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <EditCompanyDialog company={company} onSaved={() => queryClient.invalidateQueries({ queryKey: ['company', companyId] })} />
              <TransferOwnershipDialog companyId={company.id} currentOwnerId={company.owner_user_id!} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CompanyProfilePage;
