import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Trash2, Globe, Lock, Send, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupBySlug } from '@/hooks/useGroups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const GroupPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading } = useGroupBySlug(slug);

  const isFaculty = !!user && !!group && group.faculty_owner_id === user.id;

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ['group-members', group?.id],
    enabled: !!group?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('group_members')
        .select('id, user_id, status, joined_at')
        .eq('group_id', group!.id);
      if (error) throw error;
      const ids = (data || []).map((m: any) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data as any[]).map((m) => ({ ...m, profile: map.get(m.user_id) }));
    },
  });

  // Group posts (visible to members + faculty thanks to RLS)
  const { data: posts = [] } = useQuery({
    queryKey: ['group-posts', group?.id],
    enabled: !!group?.id,
    queryFn: async () => {
      const { data: links, error } = await (supabase.from as any)('post_groups')
        .select('post_id, posts(*)')
        .eq('group_id', group!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (links as any[]).map((l) => l.posts).filter(Boolean);
      const uids = [...new Set(rows.map((p) => p.user_id))];
      if (!uids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', uids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return rows.map((p) => ({ ...p, creator: map.get(p.user_id) }));
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
      const { error: linkErr } = await (supabase.from as any)('post_groups')
        .insert({ post_id: post.id, group_id: group.id });
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      setComposeContent('');
      queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Posted to ' + (group?.name ?? 'group'));
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to post'),
  });

  const togglePostVisibility = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: 'public' | 'group' }) => {
      const { error } = await supabase.from('posts').update({ visibility: next }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] }),
    onError: (e: any) => toast.error(e?.message || 'Failed to update visibility'),
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
    onError: (e: any) => toast.error(e?.message || 'Failed to remove'),
  });

  const setMemberStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'pending' }) => {
      const { error } = await (supabase.from as any)('group_members').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] }),
    onError: (e: any) => toast.error(e?.message || 'Failed to update member'),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)('group_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] });
      toast.success('Member removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove'),
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
      const { error } = await (supabase.from as any)('group_members')
        .insert({ group_id: group!.id, user_id: uid, status: 'active' });
      if (error) throw error;
    },
    onSuccess: () => {
      setSearch('');
      queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] });
      toast.success('Member added');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add'),
  });

  if (groupLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading group…</div>;
  }
  if (!group) {
    return <div className="p-12 text-center text-muted-foreground">Group not found.</div>;
  }

  const activeMembers = members.filter((m: any) => m.status === 'active');
  const pendingMembers = members.filter((m: any) => m.status === 'pending');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {isFaculty && (
          <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Faculty</Badge>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-display font-bold">{group.name}</h1>
        {group.description && (
          <p className="text-muted-foreground">{group.description}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" /> {activeMembers.length} member{activeMembers.length === 1 ? '' : 's'}
        </p>
      </header>

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
            posts.map((p: any) => (
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
                {pendingMembers.map((m: any) => (
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
              {activeMembers.map((m: any) => (
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
    </div>
  );
};

export default GroupPage;