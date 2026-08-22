import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Trash2, Globe, Lock, Send, Shield, MailPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useGroupBySlug, useMyGroups } from '@/hooks/useGroups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { toast } from 'sonner';

interface GroupAdmin {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  created_at: string;
  profile?: {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

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

interface GroupPost {
  id: string;
  user_id: string;
  content: string;
  visibility: string | null;
  created_at: string;
  creator?: ProfilePreview;
}

interface PostGroupLink {
  post_id: string;
  posts: GroupPost | null;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const GroupPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin: isPlatformAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading } = useGroupBySlug(slug);
  const { data: myGroups = [] } = useMyGroups();

  const isFaculty = !!user && !!group && (
    isPlatformAdmin ||
    group.faculty_owner_id === user.id ||
    myGroups.some((g) => g.id === group.id && g.is_faculty)
  );
  const canViewPrivateGroup = !!user && !!group && (
    isFaculty ||
    myGroups.some((g) => g.id === group.id)
  );

  const { data: groupMemberCount } = useQuery({
    queryKey: ['group-active-member-count', group?.id],
    enabled: !!group?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_group_active_member_count', {
        _group_id: group!.id,
      });
      if (error) throw error;
      return data ?? 0;
    },
  });

  // Scoped group admins
  const { data: groupAdmins = [] } = useQuery<GroupAdmin[]>({
    queryKey: ['group-admins', group?.id],
    enabled: !!group?.id && isFaculty,
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
      const map = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

      return ((data || []) as GroupAdmin[]).map((admin) => ({
        ...admin,
        profile: admin.user_id ? map.get(admin.user_id) : undefined,
      }));
    },
  });

  // Members
  const { data: members = [] } = useQuery<GroupMember[]>({
    queryKey: ['group-members', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('id, user_id, status, joined_at')
        .eq('group_id', group!.id);
      if (error) throw error;
      const ids = (data || []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((member) => ({
        ...member,
        status: member.status as GroupMember['status'],
        profile: map.get(member.user_id),
      }));
    },
  });

  // Group posts (visible to members + faculty thanks to RLS)
  const { data: posts = [] } = useQuery<GroupPost[]>({
    queryKey: ['group-posts', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from('post_groups')
        .select('post_id, posts(*)')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = ((links || []) as unknown as PostGroupLink[])
        .map((link) => link.posts)
        .filter((post): post is GroupPost => Boolean(post));
      const uids = [...new Set(rows.map((p) => p.user_id))];
      if (!uids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', uids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return rows.map((post) => ({ ...post, creator: map.get(post.user_id) }));
    },
  });

  // Compose for group (faculty or member)
  const [composeContent, setComposeContent] = useState('');
  const [composeVisibility, setComposeVisibility] = useState<'group' | 'public'>('group');
  const createPost = useMutation({
    mutationFn: async () => {
      if (!user || !group) throw new Error('Not ready');
      if (!composeContent.trim()) throw new Error('Write something first');
      const { data: post, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: composeContent.trim(), visibility: composeVisibility })
        .select('id')
        .single();
      if (error) throw error;
      const { error: linkErr } = await supabase
        .from('post_groups')
        .insert({ post_id: post.id, group_id: group.id });
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      setComposeContent('');
      queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Posted to ' + (group?.name ?? 'group'));
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to post')),
  });

  const togglePostVisibility = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: 'public' | 'group' }) => {
      const { error } = await supabase.from('posts').update({ visibility: next }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] }),
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to update visibility')),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] });
      toast.success('Post removed');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to remove')),
  });

  const setMemberStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'pending' }) => {
      const { error } = await supabase.from('group_members').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] }),
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to update member')),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] });
      toast.success('Member removed');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to remove')),
  });

  // Add member by email/name search
  const [search, setSearch] = useState('');
  const { data: searchResults = [] } = useQuery({
    queryKey: ['group-add-search', search],
    enabled: isFaculty && search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${search}%`)
        .limit(8);
      return data || [];
    },
  });
  const addMember = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: group!.id, user_id: uid, status: 'active' });
      if (error) throw error;
    },
    onSuccess: () => {
      setSearch('');
      queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] });
      toast.success('Member added');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to add')),
  });

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPendingRemoval, setAdminPendingRemoval] = useState<GroupAdmin | null>(null);
  const addAdmin = useMutation({
    mutationFn: async () => {
      if (!group) throw new Error('Group not ready');
      const { error } = await supabase.rpc('add_group_admin_by_email', {
        _group_id: group.id,
        _email: adminEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['group-admins', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('Group admin added');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to add admin')),
  });

  const removeAdmin = useMutation({
    mutationFn: async (adminId: string) => {
      const { error } = await supabase.rpc('remove_group_admin', {
        _admin_id: adminId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdminPendingRemoval(null);
      queryClient.invalidateQueries({ queryKey: ['group-admins', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('Group admin removed');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to remove admin')),
  });

  if (groupLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading group…</div>;
  }
  if (!group) {
    return <div className="p-12 text-center text-muted-foreground">Group not found.</div>;
  }

  const activeMembers = members.filter((member) => member.status === 'active');
  const pendingMembers = members.filter((member) => member.status === 'pending');
  const visibleMemberCount = groupMemberCount ?? activeMembers.length;
  const routeState = location.state as { returnTo?: string } | null;
  const handleBack = () => {
    if (routeState?.returnTo) {
      navigate(routeState.returnTo);
      return;
    }

    navigate('/people?section=groups');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {isFaculty && (
          <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Group admin</Badge>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-display font-bold">{group.name}</h1>
        {group.description && (
          <p className="text-muted-foreground">{group.description}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" /> {visibleMemberCount} member{visibleMemberCount === 1 ? '' : 's'}
        </p>
      </header>

      {canViewPrivateGroup && (
        <>
      {/* Composer */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={composeContent}
            onChange={(e) => setComposeContent(e.target.value)}
            placeholder={`Share something with ${group.name}…`}
            className="min-h-[80px]"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={composeVisibility === 'group' ? 'default' : 'outline'}
                onClick={() => setComposeVisibility('group')}
              >
                <Lock className="h-3.5 w-3.5 mr-1" /> {group.name} only
              </Button>
              <Button
                type="button"
                size="sm"
                variant={composeVisibility === 'public' ? 'default' : 'outline'}
                onClick={() => setComposeVisibility('public')}
              >
                <Globe className="h-3.5 w-3.5 mr-1" /> Public
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => createPost.mutate()}
              disabled={createPost.isPending || !composeContent.trim()}
            >
              <Send className="h-4 w-4 mr-1" /> Post
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="members">Members{pendingMembers.length ? ` (${pendingMembers.length} pending)` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-3 mt-4">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No posts yet.</p>
          ) : (
            posts.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.creator?.avatar_url || undefined} />
                        <AvatarFallback>{p.creator?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{p.creator?.display_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={p.visibility === 'public' ? 'default' : 'secondary'} className="gap-1">
                      {p.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {p.visibility === 'public' ? 'Public' : 'Group'}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                  {(isFaculty || p.user_id === user?.id) && (
                    <div className="flex gap-2 pt-2 border-t">
                      {isFaculty && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            togglePostVisibility.mutate({
                              id: p.id,
                              next: p.visibility === 'public' ? 'group' : 'public',
                            })
                          }
                        >
                          {p.visibility === 'public' ? 'Make group-only' : 'Make public'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Delete this post?')) deletePost.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-3 mt-4">
          {isFaculty && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">Group admins</p>
                  <p className="text-xs text-muted-foreground">
                    Admins can manage this group without receiving global Inlight admin access.
                  </p>
                </div>

                <form
                  className="flex flex-col sm:flex-row gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!adminEmail.trim()) return;
                    addAdmin.mutate();
                  }}
                >
                  <Input
                    type="email"
                    placeholder="admin@example.edu"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                  <Button type="submit" disabled={addAdmin.isPending || !adminEmail.trim()}>
                    <MailPlus className="h-4 w-4 mr-1" /> Add admin
                  </Button>
                </form>

                <div className="space-y-2">
                  {groupAdmins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No admins found.</p>
                  ) : (
                    groupAdmins.map((admin) => {
                      const displayName = admin.profile?.display_name || admin.email || 'Pending admin';
                      const canRemove = groupAdmins.length > 1;

                      return (
                        <div key={admin.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={admin.profile?.avatar_url || undefined} />
                              <AvatarFallback>{displayName[0]?.toUpperCase() || 'A'}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{displayName}</p>
                              {admin.email && (
                                <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={!canRemove || removeAdmin.isPending}
                            title={canRemove ? 'Remove admin' : 'A group must have at least one admin'}
                            onClick={() => setAdminPendingRemoval(admin)}
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isFaculty && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Add a student</p>
                <Input
                  placeholder="Search people by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {searchResults.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => addMember.mutate(p.user_id)}
                        className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback>{p.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        {p.display_name || 'Unknown'}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pendingMembers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Pending requests</h3>
              <div className="space-y-2">
                {pendingMembers.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback>{m.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{m.profile?.display_name || 'Unknown'}</span>
                      </div>
                      {isFaculty && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setMemberStatus.mutate({ id: m.id, status: 'active' })}>
                            Admit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember.mutate(m.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Active members</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeMembers.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/profile/${m.user_id}`)}
                      className="flex items-center gap-2 text-left hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profile?.avatar_url || undefined} />
                        <AvatarFallback>{m.profile?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{m.profile?.display_name || 'Unknown'}</span>
                    </button>
                    {isFaculty && m.user_id !== user?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-7 w-7"
                        onClick={() => {
                          if (confirm('Remove this member?')) removeMember.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={!!adminPendingRemoval}
        onOpenChange={(open) => {
          if (!open) setAdminPendingRemoval(null);
        }}
        onConfirm={() => {
          if (adminPendingRemoval) {
            removeAdmin.mutate(adminPendingRemoval.id);
          }
        }}
        title="Remove group admin?"
        description={`This will remove ${
          adminPendingRemoval?.profile?.display_name || adminPendingRemoval?.email || 'this person'
        } as an admin for ${group.name}. They will no longer be able to manage this group.`}
        isPending={removeAdmin.isPending}
      />
        </>
      )}
    </div>
  );
};

export default GroupPage;
