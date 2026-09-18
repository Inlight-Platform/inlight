import React, { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, BarChart3, BookOpen, Check, Eye, EyeOff, GraduationCap, MailPlus, Pencil, ShieldCheck, Trash2, Upload, UserPlus, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupBySlug, useMyScopedAdminGroups } from '@/hooks/useGroups';
import { parseBulkEmails } from '@/lib/groupInviteEmails';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface ProfilePreview {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface GroupMember {
  id: string;
  user_id: string;
  status: 'active' | 'pending';
  joined_at: string;
  profile?: ProfilePreview;
}

interface GroupAdmin {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  created_at: string;
  profile?: ProfilePreview;
}

interface GroupResource {
  id: string;
  group_id: string;
  title: string;
  description: string;
  url: string;
  created_by: string | null;
  created_at: string;
  is_published: boolean;
}

interface GroupInvite {
  id: string;
  email: string;
  status: string;
  membership_status_on_accept: string;
  created_at: string;
  accepted_at: string | null;
}

interface GroupActivityInsights {
  active_members: number;
  pending_requests: number;
  content_count: number;
  accepted_invites: number;
  pending_invites: number;
  invite_acceptance_percent: number;
  student_count: number;
  alumni_count: number;
  recent_activity_count: number;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const formatDate = (value: string | null) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  const context = (error as { context?: { text?: () => Promise<string> } })?.context;

  if (context?.text) {
    try {
      const text = await context.text();
      if (text.trim()) return text.trim();
    } catch {
      // Fall through to the plain error message.
    }
  }

  return (error as { message?: string })?.message || fallback;
};

const GroupAdminDashboardPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading } = useGroupBySlug(slug);
  const { data: scopedGroups = [], isLoading: scopedGroupsLoading } = useMyScopedAdminGroups();
  const [adminEmail, setAdminEmail] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourcePublished, setResourcePublished] = useState(true);
  const [editingResource, setEditingResource] = useState<GroupResource | null>(null);
  const [resourcePendingRemoval, setResourcePendingRemoval] = useState<GroupResource | null>(null);
  const [memberInviteEmails, setMemberInviteEmails] = useState('');
  const [memberInviteNote, setMemberInviteNote] = useState('');
  const [adminPendingRemoval, setAdminPendingRemoval] = useState<GroupAdmin | null>(null);

  const isScopedAdmin = !!group && scopedGroups.some((scopedGroup) => scopedGroup.id === group.id);
  const dashboardNavigationState = location.state as {
    returnTo?: string;
    adminGroups?: Array<{ id: string; slug: string; name: string }>;
  } | null;
  const dashboardReturnTo = dashboardNavigationState?.returnTo || (group ? `/groups/${group.slug}` : '/people');
  const dashboardReturnState = dashboardNavigationState?.adminGroups
    ? { adminGroups: dashboardNavigationState.adminGroups }
    : undefined;

  const invalidateGroupDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['group-dashboard-members', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['group-dashboard-admins', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['group-dashboard-resources', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['group-resources', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['group-dashboard-insights', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['group-dashboard-invites', group?.id] });
    queryClient.invalidateQueries({ queryKey: ['my-scoped-admin-groups'] });
    queryClient.invalidateQueries({ queryKey: ['my-groups'] });
  };

  const { data: members = [] } = useQuery<GroupMember[]>({
    queryKey: ['group-dashboard-members', group?.id],
    enabled: !!group?.id && isScopedAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('id, user_id, status, joined_at')
        .eq('group_id', group!.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;

      const ids = [...new Set((data || []).map((member) => member.user_id))];
      if (!ids.length) return [];

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const profileById = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

      return (data || []).map((member) => ({
        ...member,
        status: member.status as GroupMember['status'],
        profile: profileById.get(member.user_id),
      }));
    },
  });

  const { data: groupAdmins = [] } = useQuery<GroupAdmin[]>({
    queryKey: ['group-dashboard-admins', group?.id],
    enabled: !!group?.id && isScopedAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_admins')
        .select('id, group_id, user_id, email, status, created_at')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const ids = [...new Set((data || []).map((admin) => admin.user_id).filter(Boolean))] as string[];
      if (!ids.length) return (data || []) as GroupAdmin[];

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const profileById = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

      return ((data || []) as GroupAdmin[]).map((admin) => ({
        ...admin,
        profile: admin.user_id ? profileById.get(admin.user_id) : undefined,
      }));
    },
  });

  const { data: resources = [] } = useQuery<GroupResource[]>({
    queryKey: ['group-dashboard-resources', group?.id],
    enabled: !!group?.id && isScopedAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_resources')
        .select('id, group_id, title, description, url, created_by, created_at, is_published')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GroupResource[];
    },
  });

  const { data: groupInvites = [] } = useQuery<GroupInvite[]>({
    queryKey: ['group-dashboard-invites', group?.id],
    enabled: !!group?.id && isScopedAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_invites')
        .select('id, email, status, membership_status_on_accept, created_at, accepted_at')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GroupInvite[];
    },
  });

  const { data: insights } = useQuery<GroupActivityInsights>({
    queryKey: ['group-dashboard-insights', group?.id],
    enabled: !!group?.id && isScopedAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_group_activity_insights', {
        _group_id: group!.id,
      });
      if (error) throw error;
      return (data?.[0] || {
        active_members: 0,
        pending_requests: 0,
        content_count: 0,
        accepted_invites: 0,
        pending_invites: 0,
        invite_acceptance_percent: 0,
        student_count: 0,
        alumni_count: 0,
        recent_activity_count: 0,
      }) as GroupActivityInsights;
    },
  });

  const { data: memberSearchResults = [] } = useQuery<ProfilePreview[]>({
    queryKey: ['group-dashboard-member-search', group?.id, memberSearch],
    enabled: isScopedAdmin && memberSearch.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${memberSearch.trim()}%`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const pendingMembers = useMemo(() => members.filter((member) => member.status === 'pending'), [members]);
  const activeMembers = useMemo(() => members.filter((member) => member.status === 'active'), [members]);
  const pendingInvites = useMemo(
    () => groupInvites.filter((invite) => invite.status === 'pending'),
    [groupInvites],
  );
  const acceptedInvites = useMemo(
    () => groupInvites.filter((invite) => invite.status === 'accepted'),
    [groupInvites],
  );
  const activeAdminCount = groupAdmins.filter((admin) => admin.status === 'active').length;
  const parsedMemberInviteEmails = useMemo(
    () => parseBulkEmails(memberInviteEmails),
    [memberInviteEmails],
  );

  const setMemberStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'pending' }) => {
      const { error } = await supabase.from('group_members').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateGroupDashboard();
      toast.success('Join request accepted');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update membership')),
  });

  const removeMember = useMutation({
    mutationFn: async ({ id }: { id: string; action: 'remove' | 'deny' }) => {
      const { error } = await supabase.from('group_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidateGroupDashboard();
      toast.success(variables.action === 'deny' ? 'Join request denied' : 'Member removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove member')),
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!group) throw new Error('Group not ready');
      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId, status: 'active' });
      if (error) throw error;
    },
    onSuccess: () => {
      setMemberSearch('');
      invalidateGroupDashboard();
      toast.success('Member added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add member')),
  });

  const addAdmin = useMutation({
    mutationFn: async () => {
      if (!group) throw new Error('Group not ready');
      const { data, error } = await supabase.functions.invoke('send-group-admin-invite', {
        body: {
          groupId: group.id,
          email: adminEmail.trim(),
          note: `You've been invited to administer ${group.name} on Inlight.`,
        },
      });
      if (error) {
        throw new Error(await getFunctionErrorMessage(error, 'Failed to add admin'));
      }
      return data as {
        invite: { existing_user: boolean };
        email: { sent: boolean; notRequired?: boolean; error?: unknown };
      };
    },
    onSuccess: (result) => {
      setAdminEmail('');
      invalidateGroupDashboard();
      if (result.invite.existing_user) {
        toast.success('Group admin added');
      } else if (result.email.sent) {
        toast.success('Group admin invited and email sent');
      } else {
        toast.warning('Group admin invitation saved, but the email could not be sent');
      }
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to add admin')),
  });

  const removeAdmin = useMutation({
    mutationFn: async (adminId: string) => {
      const { error } = await supabase.rpc('remove_group_admin', { _admin_id: adminId });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdminPendingRemoval(null);
      invalidateGroupDashboard();
      toast.success('Group admin removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove admin')),
  });

  const updateDirectoryListing = useMutation({
    mutationFn: async (isListed: boolean) => {
      if (!group) throw new Error('Group not ready');
      const { error } = await supabase.rpc('update_group_directory_listing', {
        _group_id: group.id,
        _is_listed: isListed,
      });
      if (error) throw error;
      return isListed;
    },
    onSuccess: (isListed) => {
      queryClient.invalidateQueries({ queryKey: ['group-by-slug', group?.slug] });
      queryClient.invalidateQueries({ queryKey: ['listed-departments'] });
      toast.success(isListed ? 'Department listed in directory' : 'Department removed from directory');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update directory listing')),
  });

  const updateMemberPosting = useMutation({
    mutationFn: async (membersCanPost: boolean) => {
      if (!group) throw new Error('Group not ready');
      const { error } = await supabase.rpc('update_group_member_posting', {
        _group_id: group.id,
        _members_can_post: membersCanPost,
      });
      if (error) throw error;
      return membersCanPost;
    },
    onSuccess: (membersCanPost) => {
      queryClient.invalidateQueries({ queryKey: ['group-by-slug', group?.slug] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success(membersCanPost ? 'Member posting enabled' : 'Member posting disabled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update member posting')),
  });

  const resetResourceForm = () => {
    setResourceTitle('');
    setResourceUrl('');
    setResourceDescription('');
    setResourcePublished(true);
    setEditingResource(null);
  };

  const saveResource = useMutation({
    mutationFn: async () => {
      if (!group || !user) throw new Error('Group not ready');
      const values = {
        group_id: group.id,
        title: resourceTitle.trim(),
        description: resourceDescription.trim(),
        url: resourceUrl.trim(),
        is_published: resourcePublished,
      };
      const { error } = editingResource
        ? await supabase.from('group_resources').update(values).eq('id', editingResource.id).eq('group_id', group.id)
        : await supabase.from('group_resources').insert({ ...values, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      const wasEditing = !!editingResource;
      resetResourceForm();
      invalidateGroupDashboard();
      toast.success(wasEditing ? 'Resource updated' : 'Resource added');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save resource')),
  });

  const toggleResourcePublication = useMutation({
    mutationFn: async (resource: GroupResource) => {
      const { error } = await supabase
        .from('group_resources')
        .update({ is_published: !resource.is_published })
        .eq('id', resource.id)
        .eq('group_id', resource.group_id);
      if (error) throw error;
      return !resource.is_published;
    },
    onSuccess: (published) => {
      invalidateGroupDashboard();
      toast.success(published ? 'Resource published' : 'Resource moved to drafts');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update publication status')),
  });

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_resources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setResourcePendingRemoval(null);
      invalidateGroupDashboard();
      toast.success('Resource removed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove resource')),
  });

  const handleMemberInviteFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      setMemberInviteEmails((current) => [current.trim(), text.trim()].filter(Boolean).join('\n'));
      toast.success('Email list added from file.');
    } catch {
      toast.error('Could not read that email file.');
    }
  };

  const sendMemberInvites = useMutation({
    mutationFn: async () => {
      if (!group) throw new Error('Group not ready');
      const parsed = parseBulkEmails(memberInviteEmails);

      if (parsed.validEmails.length === 0) {
        throw new Error('Enter at least one valid email address.');
      }

      const { data, error } = await supabase.functions.invoke('send-group-member-invites', {
        body: {
          groupId: group.id,
          emails: parsed.validEmails,
          note: memberInviteNote.trim() || null,
          membershipStatusOnAccept: 'active',
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error, 'Failed to send group invites'));
      }

      return data as {
        result?: {
          counts?: {
            accepted?: number;
            pending?: number;
            invalid?: number;
            duplicates?: number;
          };
        };
        emails?: {
          sent?: Array<{ email: string }>;
          failed?: Array<{ email: string; error: unknown }>;
        };
      };
    },
    onSuccess: (data) => {
      const invalidCount = parsedMemberInviteEmails.invalidEmails.length;
      const duplicateCount = parsedMemberInviteEmails.duplicateEmails.length;
      const acceptedCount = data.result?.counts?.accepted ?? 0;
      const pendingCount = data.result?.counts?.pending ?? 0;
      const sentCount = data.emails?.sent?.length ?? 0;
      setMemberInviteEmails('');
      setMemberInviteNote('');
      invalidateGroupDashboard();
      const skippedText = invalidCount || duplicateCount
        ? ` Skipped ${invalidCount} invalid and ${duplicateCount} duplicate email${invalidCount + duplicateCount === 1 ? '' : 's'}.`
        : '';
      toast.success(
        `Processed ${acceptedCount + pendingCount} member invite${acceptedCount + pendingCount === 1 ? '' : 's'}; ${sentCount} email${sentCount === 1 ? '' : 's'} sent.${skippedText}`
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to send group invites')),
  });

  if (groupLoading || scopedGroupsLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  if (!group) {
    return <div className="p-12 text-center text-muted-foreground">Group not found.</div>;
  }

  if (!isScopedAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">Group dashboard unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Only admins directly assigned to {group.name} can manage this dashboard.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to={dashboardReturnTo} state={dashboardReturnState}>Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={dashboardReturnTo} state={dashboardReturnState}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-display font-bold">{group.name} Dashboard</h1>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Department admin
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage only this department portal: verification, insights, resources, and invites.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="verification" className="space-y-4">
        <TabsList className="mx-auto grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="verification" className="px-2 text-xs sm:text-sm">Verification</TabsTrigger>
          <TabsTrigger value="insights" className="px-2 text-xs sm:text-sm">Insights</TabsTrigger>
          <TabsTrigger value="resources" className="px-2 text-xs sm:text-sm">Resources</TabsTrigger>
          <TabsTrigger value="invites" className="px-2 text-xs sm:text-sm">Invites</TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" /> Member Posting
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="group-member-posting">Allow members to post</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Let active members share services, events, opportunities, and projects with this department.
                </p>
              </div>
              <Switch
                id="group-member-posting"
                checked={group.members_can_post}
                disabled={updateMemberPosting.isPending}
                onCheckedChange={(checked) => updateMemberPosting.mutate(checked)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" /> Directory Listing
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="group-directory-listing">Listed in directory</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Show this department under Community so non-members can find it and request to join.
                </p>
              </div>
              <Switch
                id="group-directory-listing"
                checked={group.is_listed}
                disabled={updateDirectoryListing.isPending}
                onCheckedChange={(checked) => updateDirectoryListing.mutate(checked)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" /> Join Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                pendingMembers.map((member) => (
                  <div key={member.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <PersonRow profile={member.profile} fallback="Pending member" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setMemberStatus.mutate({ id: member.id, status: 'active' })}>
                        <Check className="mr-1 h-4 w-4" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeMember.mutate({ id: member.id, action: 'deny' })}
                      >
                        <X className="mr-1 h-4 w-4" /> Deny
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard icon={UserPlus} label="Active Members" value={insights?.active_members ?? 0} />
          <InsightCard icon={ShieldCheck} label="Pending Requests" value={insights?.pending_requests ?? 0} />
          <InsightCard
            icon={BarChart3}
            label="Department Content"
            value={insights?.content_count ?? 0}
            detail="Posts, events, and projects"
          />
          <InsightCard
            icon={MailPlus}
            label="Invite Acceptance"
            value={`${insights?.invite_acceptance_percent ?? 0}%`}
            detail={`${insights?.accepted_invites ?? 0} accepted of ${(insights?.accepted_invites ?? 0) + (insights?.pending_invites ?? 0)}`}
          />
          <InsightCard
            icon={UsersRound}
            label="Students"
            value={insights?.student_count ?? 0}
            detail="Active members"
          />
          <InsightCard
            icon={GraduationCap}
            label="Alumni"
            value={insights?.alumni_count ?? 0}
            detail="Active members"
          />
          <InsightCard
            icon={Activity}
            label="Recent Activity"
            value={insights?.recent_activity_count ?? 0}
            detail="Department activity in the last 30 days"
          />
        </TabsContent>

        <TabsContent value="resources" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" /> Private Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resources.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No resources yet.</p>
              ) : (
                resources.map((resource) => (
                  <div key={resource.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={resource.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {resource.title}
                        </a>
                        <Badge variant={resource.is_published ? 'default' : 'secondary'}>
                          {resource.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      {resource.description && <p className="text-sm text-muted-foreground">{resource.description}</p>}
                      <p className="truncate text-xs text-muted-foreground">{resource.url}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit resource" onClick={() => {
                        setEditingResource(resource);
                        setResourceTitle(resource.title);
                        setResourceUrl(resource.url);
                        setResourceDescription(resource.description);
                        setResourcePublished(resource.is_published);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={resource.is_published ? 'Unpublish resource' : 'Publish resource'} onClick={() => toggleResourcePublication.mutate(resource)}>
                        {resource.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete resource" onClick={() => setResourcePendingRemoval(resource)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{editingResource ? 'Edit Resource' : 'Add Resource'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!resourceTitle.trim() || !resourceUrl.trim()) return;
                  saveResource.mutate();
                }}
              >
                <Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="Resource title" />
                <Input value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://..." />
                <Textarea
                  value={resourceDescription}
                  onChange={(event) => setResourceDescription(event.target.value)}
                  placeholder="Short description"
                  className="min-h-[88px]"
                />
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <Label htmlFor="resource-published">Published</Label>
                    <p className="text-xs text-muted-foreground">Members can view this resource.</p>
                  </div>
                  <Switch id="resource-published" checked={resourcePublished} onCheckedChange={setResourcePublished} />
                </div>
                <div className="flex gap-2">
                  {editingResource && <Button type="button" variant="outline" className="flex-1" onClick={resetResourceForm}>Cancel</Button>}
                  <Button type="submit" className="flex-1" disabled={!resourceTitle.trim() || !resourceUrl.trim() || saveResource.isPending}>
                    {editingResource ? 'Save changes' : 'Add resource'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MailPlus className="h-5 w-5" /> Group Admins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!adminEmail.trim()) return;
                  addAdmin.mutate();
                }}
              >
                <Input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@example.edu" />
                <Button type="submit" disabled={!adminEmail.trim() || addAdmin.isPending}>
                  Add admin
                </Button>
              </form>

              <div className="space-y-2">
                {groupAdmins.map((admin) => {
                  const displayName = admin.profile?.display_name || admin.email || 'Pending admin';
                  const canRemove = activeAdminCount > 1;
                  return (
                    <div key={admin.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <PersonRow profile={admin.profile} fallback={displayName} secondary={admin.email || admin.status} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={!canRemove || removeAdmin.isPending}
                        title={canRemove ? 'Remove admin' : 'A group must have at least one active admin'}
                        onClick={() => setAdminPendingRemoval(admin)}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5" /> Members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-3 rounded-lg border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMemberInvites.mutate();
                }}
              >
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="member-invite-emails">Bulk email invites</Label>
                    <div>
                      <Input
                        id="member-invite-file"
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        className="sr-only"
                        onChange={handleMemberInviteFile}
                      />
                      <Button asChild type="button" variant="outline" size="sm">
                        <label htmlFor="member-invite-file" className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload CSV/TXT
                        </label>
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="member-invite-emails"
                    value={memberInviteEmails}
                    onChange={(event) => setMemberInviteEmails(event.target.value)}
                    placeholder="Paste emails separated by commas, spaces, or new lines"
                    className="min-h-[120px]"
                  />
                </div>
                <Input
                  value={memberInviteNote}
                  onChange={(event) => setMemberInviteNote(event.target.value)}
                  placeholder="Optional note for invite email"
                />
                {memberInviteEmails.trim() && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{parsedMemberInviteEmails.validEmails.length} valid email{parsedMemberInviteEmails.validEmails.length === 1 ? '' : 's'} ready.</p>
                    {parsedMemberInviteEmails.invalidEmails.length > 0 && (
                      <p className="text-destructive">
                        Invalid: {parsedMemberInviteEmails.invalidEmails.slice(0, 4).join(', ')}
                        {parsedMemberInviteEmails.invalidEmails.length > 4 ? `, +${parsedMemberInviteEmails.invalidEmails.length - 4} more` : ''}
                      </p>
                    )}
                    {parsedMemberInviteEmails.duplicateEmails.length > 0 && (
                      <p>
                        Duplicates skipped: {parsedMemberInviteEmails.duplicateEmails.slice(0, 4).join(', ')}
                        {parsedMemberInviteEmails.duplicateEmails.length > 4 ? `, +${parsedMemberInviteEmails.duplicateEmails.length - 4} more` : ''}
                      </p>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={parsedMemberInviteEmails.validEmails.length === 0 || sendMemberInvites.isPending}
                >
                  {sendMemberInvites.isPending ? 'Sending invites...' : 'Send member invites'}
                </Button>
              </form>

              <div className="space-y-2">
                <p className="text-sm font-medium">Add existing member</p>
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search people by name..."
                />
                {memberSearchResults.length > 0 && (
                  <div className="rounded-lg border">
                    {memberSearchResults.map((profile) => (
                      <button
                        type="button"
                        key={profile.user_id}
                        onClick={() => addMember.mutate(profile.user_id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        {profile.display_name || 'Unknown'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border">
                <div className="border-b px-3 py-2">
                  <p className="text-sm font-medium">Member roster</p>
                  <p className="text-xs text-muted-foreground">
                    Active members, pending join requests, and invited emails for this department.
                  </p>
                </div>

                <RosterSection title="Active members" count={activeMembers.length}>
                  {activeMembers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No active members yet.</p>
                  ) : (
                    activeMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 border-t px-3 py-3 first:border-t-0"
                      >
                        <PersonRow profile={member.profile} fallback="Member" secondary="Active member" />
                        {member.user_id !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={removeMember.isPending}
                            onClick={() => removeMember.mutate({ id: member.id, action: 'remove' })}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </RosterSection>

                <RosterSection title="Pending join requests" count={pendingMembers.length}>
                  {pendingMembers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No pending join requests.</p>
                  ) : (
                    pendingMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col gap-3 border-t px-3 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <PersonRow profile={member.profile} fallback="Pending member" secondary="Requested access" />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={setMemberStatus.isPending}
                            onClick={() => setMemberStatus.mutate({ id: member.id, status: 'active' })}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={removeMember.isPending}
                            onClick={() => removeMember.mutate({ id: member.id, action: 'deny' })}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </RosterSection>

                <RosterSection title="Invited emails" count={pendingInvites.length}>
                  {pendingInvites.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No pending email invites.</p>
                  ) : (
                    pendingInvites.map((invite) => <InviteRosterRow key={invite.id} invite={invite} />)
                  )}
                </RosterSection>

                {acceptedInvites.length > 0 && (
                  <RosterSection title="Accepted email invites" count={acceptedInvites.length}>
                    {acceptedInvites.map((invite) => <InviteRosterRow key={invite.id} invite={invite} />)}
                  </RosterSection>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={!!adminPendingRemoval}
        onOpenChange={(open) => {
          if (!open) setAdminPendingRemoval(null);
        }}
        onConfirm={() => {
          if (adminPendingRemoval) removeAdmin.mutate(adminPendingRemoval.id);
        }}
        title="Remove group admin?"
        description={`This removes ${
          adminPendingRemoval?.profile?.display_name || adminPendingRemoval?.email || 'this person'
        } from the ${group.name} admin list.`}
        isPending={removeAdmin.isPending}
      />
      <DeleteConfirmDialog
        open={!!resourcePendingRemoval}
        onOpenChange={(open) => {
          if (!open) setResourcePendingRemoval(null);
        }}
        onConfirm={() => {
          if (resourcePendingRemoval) deleteResource.mutate(resourcePendingRemoval.id);
        }}
        title="Delete resource?"
        description={`This permanently deletes ${resourcePendingRemoval?.title || 'this resource'} from ${group.name}.`}
        isPending={deleteResource.isPending}
      />
    </div>
  );
};

const PersonRow: React.FC<{ profile?: ProfilePreview; fallback: string; secondary?: string | null }> = ({ profile, fallback, secondary }) => {
  const label = profile?.display_name || fallback;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback>{label[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
};

const RosterSection: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <div>
    <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <Badge variant="secondary">{count}</Badge>
    </div>
    {children}
  </div>
);

const InviteRosterRow: React.FC<{ invite: GroupInvite }> = ({ invite }) => {
  const statusDate = formatDate(invite.accepted_at || invite.created_at);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Becomes {invite.membership_status_on_accept} member{statusDate ? ` · ${statusDate}` : ''}
        </p>
      </div>
      <Badge variant={invite.status === 'accepted' ? 'default' : 'secondary'}>{invite.status}</Badge>
    </div>
  );
};

const InsightCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number | string;
  detail?: string;
}> = ({ icon: Icon, label, value, detail }) => (
  <Card>
    <CardContent className="flex items-center justify-between p-5">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

export default GroupAdminDashboardPage;
