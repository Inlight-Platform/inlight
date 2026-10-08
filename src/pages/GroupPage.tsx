import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CalendarClock, ExternalLink, Users, Trash2, Globe, Lock, Shield, MailPlus, MessageSquare, MoreHorizontal, SlidersHorizontal, Check, Plus, LayoutGrid, Rows, Calendar, FolderKanban, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupBySlug, useMyGroups } from '@/hooks/useGroups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageCarousel } from '@/components/feed/ImageCarousel';
import { FeedItem, FeedItemData } from '@/components/feed/FeedItem';
import { FeedBentoCardWithComments, getBentoSize } from '@/components/feed/FeedBentoCard';
import { PostComments } from '@/components/feed/PostComments';
import { PostCreator } from '@/components/feed/PostCreator';
import { getFeedItemDestination } from '@/lib/feedDestinations';
import { groupEventPath, groupPostPath, groupProjectPath, identifierFallbackShortId, identifierFallbackUuid } from '@/lib/publicPaths';
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

interface GroupResource {
  id: string;
  group_id: string;
  title: string;
  description: string;
  url: string;
  is_published: boolean;
  created_at: string;
}

interface GroupAuditionTimeslot {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
}

interface GroupAudition {
  id: string;
  title: string;
  description: string;
  materials: string;
  is_published: boolean;
  created_at: string;
  group_audition_timeslots: GroupAuditionTimeslot[];
}

interface GroupAuditionAvailability {
  audition_id: string;
  timeslot_id: string;
  booked_count: number;
  capacity: number;
  is_my_timeslot: boolean;
}

interface GroupPost {
  id: string;
  user_id: string;
  content: string;
  visibility: string | null;
  created_at: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  image_position_x?: number | null;
  image_position_y?: number | null;
  image_zoom?: number | null;
  image_positions?: Array<{ x?: number | null; y?: number | null; zoom?: number | null }> | null;
  author_identity: string;
  author_group_id: string | null;
  creator?: ProfilePreview;
}

interface PostGroupLink {
  post_id: string;
  posts: GroupPost | null;
}

interface ProjectGroupLink {
  projects: {
    id: string;
    creator_id: string;
    title: string;
    description: string | null;
    header_image_url: string | null;
    main_image_url: string | null;
    created_at: string;
    category: string | null;
    status: string | null;
    link_url: string | null;
    link_title: string | null;
    visibility: string | null;
    author_identity: string;
    author_group_id: string | null;
  } | null;
}

interface EventGroupLink {
  events: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    image_urls: string[] | null;
    image_position_x: number | null;
    image_position_y: number | null;
    image_zoom: number | null;
    image_positions: Array<{ x?: number | null; y?: number | null; zoom?: number | null }> | null;
    created_at: string;
    event_date: string;
    location: string | null;
    event_type: string | null;
    visibility: string | null;
    is_paid: boolean;
    price: number | null;
    currency: string | null;
    stripe_price_id: string | null;
    payment_link_url: string | null;
    author_identity: string;
    author_group_id: string | null;
  } | null;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type GroupPageTab = 'all' | 'events' | 'projects' | 'services' | 'auditions' | 'members' | 'resources';
const GROUP_CONTENT_TABS: GroupPageTab[] = ['all', 'events', 'projects', 'services'];

const GroupPage: React.FC = () => {
  const { slug, postIdentifier, eventIdentifier, projectIdentifier } = useParams<{
    slug: string;
    postIdentifier?: string;
    eventIdentifier?: string;
    projectIdentifier?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading } = useGroupBySlug(slug);
  const { data: myGroups = [], isLoading: myGroupsLoading } = useMyGroups();
  const { data: currentUserProfile } = useQuery({
    queryKey: ['group-page-current-user-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isFaculty = !!user && !!group && (
    group.faculty_owner_id === user.id ||
    myGroups.some((g) => g.id === group.id && g.is_faculty)
  );
  const canViewPrivateGroup = !!user && !!group && (
    isFaculty ||
    myGroups.some((g) => g.id === group.id)
  );

  const { data: myMembership } = useQuery<GroupMember | null>({
    queryKey: ['my-group-membership', group?.id, user?.id],
    enabled: !!group?.id && !!user?.id && !canViewPrivateGroup && !myGroupsLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('id, user_id, status, joined_at')
        .eq('group_id', group!.id)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, status: data.status as GroupMember['status'] }) : null;
    },
  });

  const requestJoin = useMutation({
    mutationFn: async () => {
      if (!user || !group) throw new Error('Log in to request access');
      const { error } = await supabase.rpc('request_group_membership', {
        _group_id: group.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-group-membership', group?.id, user?.id] });
      toast.success('Request sent');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to request access')),
  });

  const { data: groupMemberCount } = useQuery({
    queryKey: ['group-active-member-count', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
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
      return rows.map((post) => ({
        ...post,
        creator: post.author_identity === 'group' && post.author_group_id === group!.id
          ? { user_id: group!.id, display_name: group!.name, avatar_url: null }
          : map.get(post.user_id),
      }));
    },
  });

  const { data: projects = [] } = useQuery<FeedItemData[]>({
    queryKey: ['group-projects', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from('project_groups')
        .select('project_id, projects(*)')
        .eq('group_id', group!.id);
      if (error) throw error;

      const rows = ((links || []) as unknown as ProjectGroupLink[])
        .map((link) => link.projects)
        .filter((project): project is NonNullable<ProjectGroupLink['projects']> => Boolean(project));
      const ids = [...new Set(rows.map((project) => project.creator_id))];
      const { data: profiles } = ids.length
        ? await supabase.from('profiles_public').select('user_id, display_name, avatar_url').in('user_id', ids)
        : { data: [] };
      const profileById = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

      return rows.map((project) => ({
        id: project.id,
        type: 'project' as const,
        user_id: project.creator_id,
        title: project.title,
        description: project.description || undefined,
        image_url: project.header_image_url || project.main_image_url,
        created_at: project.created_at,
        category: project.category,
        project_status: project.status || undefined,
        link_url: project.link_url,
        link_title: project.link_title,
        visibility: project.visibility || undefined,
        author_identity: project.author_identity,
        author_group_id: project.author_group_id,
        creator_profile: project.author_identity === 'group' && project.author_group_id === group!.id
          ? { display_name: group!.name, avatar_url: null }
          : profileById.get(project.creator_id),
      }));
    },
  });

  const { data: events = [] } = useQuery<FeedItemData[]>({
    queryKey: ['group-events', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from('event_groups')
        .select('event_id, events(*)')
        .eq('group_id', group!.id);
      if (error) throw error;

      const rows = ((links || []) as unknown as EventGroupLink[])
        .map((link) => link.events)
        .filter((event): event is NonNullable<EventGroupLink['events']> => Boolean(event));
      const ids = [...new Set(rows.map((event) => event.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from('profiles_public').select('user_id, display_name, avatar_url').in('user_id', ids)
        : { data: [] };
      const profileById = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

      return rows.map((event) => ({
        id: event.id,
        type: 'event' as const,
        user_id: event.user_id,
        title: event.title,
        description: event.description || undefined,
        image_url: event.image_url,
        image_urls: event.image_urls,
        image_position_x: event.image_position_x,
        image_position_y: event.image_position_y,
        image_zoom: event.image_zoom,
        image_positions: event.image_positions,
        created_at: event.created_at,
        event_date: event.event_date,
        location: event.location || undefined,
        event_type: event.event_type || undefined,
        visibility: event.visibility || undefined,
        is_paid: event.is_paid,
        price: event.price,
        currency: event.currency,
        stripe_price_id: event.stripe_price_id,
        payment_link_url: event.payment_link_url,
        author_identity: event.author_identity,
        author_group_id: event.author_group_id,
        creator_profile: event.author_identity === 'group' && event.author_group_id === group!.id
          ? { display_name: group!.name, avatar_url: null }
          : profileById.get(event.user_id),
      }));
    },
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<GroupResource[]>({
    queryKey: ['group-resources', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_resources')
        .select('id, group_id, title, description, url, is_published, created_at')
        .eq('group_id', group!.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GroupResource[];
    },
  });

  const { data: auditions = [], isLoading: auditionsLoading } = useQuery<GroupAudition[]>({
    queryKey: ['group-auditions', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('group_auditions')
        .select('id, title, description, materials, is_published, created_at, group_audition_timeslots(id, starts_at, ends_at, capacity)')
        .eq('group_id', group!.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GroupAudition[];
    },
  });

  const { data: auditionAvailability = [] } = useQuery<GroupAuditionAvailability[]>({
    queryKey: ['group-audition-availability', group?.id, user?.id],
    enabled: !!group?.id && !!user?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_group_audition_availability', {
        _group_id: group!.id,
      });
      if (error) throw error;
      return (data || []) as GroupAuditionAvailability[];
    },
  });

  const { data: activeAdminUserIds = [] } = useQuery<string[]>({
    queryKey: ['group-active-admin-user-ids', group?.id],
    enabled: !!group?.id && canViewPrivateGroup,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_group_active_admin_user_ids', {
        _group_id: group!.id,
      });
      if (error) throw error;
      return (data || []).map((row) => row.user_id);
    },
  });

  const activeAdminUserIdSet = new Set(activeAdminUserIds);
  const isAdminAuthored = (authorIdentity: string | undefined, authorGroupId: string | null | undefined, userId: string) =>
    (authorIdentity === 'group' && authorGroupId === group?.id) || activeAdminUserIdSet.has(userId);

  const groupContent = [
    ...posts.map((post) => ({
      kind: 'post' as const,
      createdAt: post.created_at,
      adminAuthored: isAdminAuthored(post.author_identity, post.author_group_id, post.user_id),
      post,
    })),
    ...projects.map((item) => ({
      kind: 'feed' as const,
      createdAt: item.created_at,
      adminAuthored: isAdminAuthored(item.author_identity, item.author_group_id, item.user_id),
      item,
    })),
    ...events.map((item) => ({
      kind: 'feed' as const,
      createdAt: item.created_at,
      adminAuthored: isAdminAuthored(item.author_identity, item.author_group_id, item.user_id),
      item,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [postPendingRemoval, setPostPendingRemoval] = useState<GroupPost | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedItemData | null>(null);
  const [postFilter, setPostFilter] = useState<'all' | 'admin'>('all');
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [historyView, setHistoryView] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<GroupPageTab>(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    return requestedTab && ['all', 'events', 'projects', 'services', 'auditions', 'members', 'resources'].includes(requestedTab)
      ? requestedTab as GroupPageTab
      : 'all';
  });
  const bookAuditionTimeslot = useMutation({
    mutationFn: async ({ auditionId, timeslotId }: { auditionId: string; timeslotId: string }) => {
      const { error } = await (supabase as any).rpc('book_group_audition_timeslot', {
        _audition_id: auditionId,
        _timeslot_id: timeslotId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-audition-availability', group?.id] });
      toast.success('Audition timeslot reserved');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to reserve timeslot')),
  });
  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', group?.id] });
      toast.success('Post removed');
      setPostPendingRemoval(null);
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
      const { data, error } = await supabase.functions.invoke('send-group-admin-invite', {
        body: {
          groupId: group.id,
          email: adminEmail.trim(),
          note: `You've been invited to administer ${group.name} on Inlight.`,
        },
      });
      if (error) throw error;
      return data as {
        invite: { existing_user: boolean };
        email: { sent: boolean; notRequired?: boolean; error?: unknown };
      };
    },
    onSuccess: (result) => {
      setAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['group-admins', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['group-members', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['group-active-member-count', group?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      if (result.invite.existing_user) {
        toast.success('Group admin added');
      } else if (result.email.sent) {
        toast.success('Group admin invited and email sent');
      } else {
        toast.warning('Group admin invitation saved, but the email could not be sent');
      }
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

  const mapGroupPostToFeedItem = (post: GroupPost): FeedItemData => ({
    id: post.id,
    type: 'post',
    user_id: post.user_id,
    content: post.content,
    image_url: post.image_url,
    image_urls: post.image_urls,
    image_position_x: post.image_position_x,
    image_position_y: post.image_position_y,
    image_zoom: post.image_zoom,
    image_positions: post.image_positions,
    created_at: post.created_at,
    visibility: post.visibility || undefined,
    author_identity: post.author_identity,
    author_group_id: post.author_group_id,
    creator_profile: post.creator
      ? { display_name: post.creator.display_name, avatar_url: post.creator.avatar_url }
      : undefined,
  });

  useEffect(() => {
    const identifier = postIdentifier || eventIdentifier || projectIdentifier;
    const expectedType = postIdentifier ? 'post' : eventIdentifier ? 'event' : projectIdentifier ? 'project' : null;
    if (!identifier || selectedItem?.type === expectedType) return;

    const fullId = identifierFallbackUuid(identifier);
    const shortId = fullId ? null : identifierFallbackShortId(identifier);
    const matchesIdentifier = (candidate: { id: string }) => (
      fullId
        ? candidate.id === fullId
        : shortId
          ? candidate.id.replace(/-/g, '').toLowerCase().startsWith(shortId.toLowerCase())
          : false
    );

    if (postIdentifier) {
      const post = posts.find(matchesIdentifier);
      if (post) setSelectedItem(mapGroupPostToFeedItem(post));
      return;
    }

    const item = (eventIdentifier ? events : projects).find(matchesIdentifier);
    if (item) setSelectedItem(item);
  }, [eventIdentifier, events, postIdentifier, posts, projectIdentifier, projects, selectedItem?.type]);

  if (groupLoading || myGroupsLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading group…</div>;
  }
  if (!group) {
    return <div className="p-12 text-center text-muted-foreground">Group not found.</div>;
  }

  const activeMembers = members.filter((member) => member.status === 'active');
  const pendingMembers = members.filter((member) => member.status === 'pending');
  const visibleMemberCount = groupMemberCount ?? activeMembers.length;
  const canPostToGroup = isFaculty || group.members_can_post;
  const isContentTab = GROUP_CONTENT_TABS.includes(activeTab);
  const visibleGroupContent = groupContent.filter((entry) => {
    if (postFilter === 'admin' && !entry.adminAuthored) return false;
    if (activeTab === 'events') return entry.kind === 'feed' && entry.item.type === 'event';
    if (activeTab === 'projects') return entry.kind === 'feed' && entry.item.type === 'project';
    if (activeTab === 'services') return entry.kind === 'post' && !entry.post.content.startsWith('🎯');
    return true;
  });
  const getGroupFeedItem = (entry: (typeof groupContent)[number]): FeedItemData => {
    if (entry.kind === 'feed') return entry.item;
    return mapGroupPostToFeedItem(entry.post);
  };

  const closeGroupDetails = () => {
    setSelectedItem(null);
    if (postIdentifier || eventIdentifier || projectIdentifier) {
      navigate(`/groups/${group.slug}`, { replace: true });
    }
  };

  const openGroupFeedItem = (item: FeedItemData) => {
    if (item.type === 'project') {
      setSelectedItem(item);
      navigate(groupProjectPath(group.slug, item));
      return;
    }
    if (item.type === 'event') {
      setSelectedItem(item);
      navigate(groupEventPath(group.slug, item));
      return;
    }
    if (item.type === 'post' || item.type === 'job') {
      setSelectedItem(item);
      navigate(groupPostPath(group.slug, { id: item.id, content: item.content }));
      return;
    }

    const destination = getFeedItemDestination(item);
    if (destination?.kind === 'internal') {
      navigate(destination.to, { state: { returnTo } });
    } else if (destination?.kind === 'external') {
      window.open(destination.url, '_blank', 'noopener,noreferrer');
    }
  };
  const unlinkGroupContent = async (item: FeedItemData) => {
    if (item.type !== 'event' && item.type !== 'project') {
      throw new Error('Only events and projects can be removed from a department without deleting them.');
    }
    const { error } = await supabase.rpc('remove_group_content' as never, {
      target_group_id: group.id,
      target_content_type: item.type,
      target_content_id: item.id,
    } as never);
    if (error) throw error;
  };
  const routeState = location.state as { returnTo?: string } | null;
  const handleBack = () => {
    if (routeState?.returnTo) {
      navigate(routeState.returnTo);
      return;
    }

    navigate('/people?section=groups');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {isFaculty && (
          <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Group admin</Badge>
        )}
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
          {canViewPrivateGroup && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {visibleMemberCount} member{visibleMemberCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {canViewPrivateGroup && canPostToGroup && (
          <Button onClick={() => setShowPostCreator(true)} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Make a Post
          </Button>
        )}
      </header>

      <div className="-mx-4 border-t border-border sm:-mx-6 lg:-mx-8" aria-hidden="true" />

      {!canViewPrivateGroup && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Private group</h2>
              <p className="text-sm text-muted-foreground">
                Posts, projects, and member details are only available to active members.
              </p>
            </div>
            {!user ? (
              <Button onClick={() => navigate('/auth')}>Log in to request access</Button>
            ) : myMembership?.status === 'pending' ? (
              <Badge variant="secondary">Request pending</Badge>
            ) : (
              <Button onClick={() => requestJoin.mutate()} disabled={requestJoin.isPending}>
                {requestJoin.isPending ? 'Sending…' : 'Request to join'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {canViewPrivateGroup && (
        <>
        <section className="min-w-0">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupPageTab)}>
        <div className="relative flex items-center justify-center gap-2">
          <div className="flex min-w-0 items-center justify-center gap-2">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="events" className="gap-1.5"><Calendar className="h-4 w-4" />Events</TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5"><FolderKanban className="h-4 w-4" />Projects</TabsTrigger>
              <TabsTrigger value="services" className="gap-1.5"><User className="h-4 w-4" />Services</TabsTrigger>
              <TabsTrigger value="auditions" className="gap-1.5"><CalendarClock className="h-4 w-4" />Auditions</TabsTrigger>
              <TabsTrigger value="members">
                Members
                {pendingMembers.length > 0 && (
                  <span className="hidden sm:inline"> ({pendingMembers.length} pending)</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
            </TabsList>
            {isContentTab && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`Filter posts: ${postFilter === 'all' ? 'All posts' : 'Admin posts'}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPostFilter('all')}>
                    <Check className={`mr-2 h-4 w-4 ${postFilter === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                    All posts
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPostFilter('admin')}>
                    <Check className={`mr-2 h-4 w-4 ${postFilter === 'admin' ? 'opacity-100' : 'opacity-0'}`} />
                    Admin posts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {isContentTab && (
            <div className="flex shrink-0 justify-end sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
              <Select value={historyView} onValueChange={(value: 'grid' | 'list') => setHistoryView(value)}>
                <SelectTrigger className="h-9 w-[96px] sm:w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">
                    <span className="inline-flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Grid</span>
                  </SelectItem>
                  <SelectItem value="list">
                    <span className="inline-flex items-center gap-2"><Rows className="h-4 w-4" /> List</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {isContentTab && <TabsContent value={activeTab} className="mt-4">
          {visibleGroupContent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {postFilter === 'admin'
                ? `No admin ${activeTab === 'all' ? 'content' : activeTab} yet.`
                : `No ${activeTab === 'all' ? 'content' : activeTab} yet.`}
            </p>
          ) : (
            <div
              className={
                historyView === 'grid'
                  ? 'grid grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-5 sm:auto-rows-[220px]'
                  : 'flex flex-col gap-4 max-w-2xl mx-auto'
              }
              style={historyView === 'grid' ? { gridAutoFlow: 'dense' } : undefined}
            >
            {visibleGroupContent.map((entry, index) => historyView === 'grid' ? (
              <FeedBentoCardWithComments
                key={`group-grid-${entry.kind}-${entry.kind === 'feed' ? entry.item.id : entry.post.id}`}
                item={getGroupFeedItem(entry)}
                size={getBentoSize(index)}
                onClick={() => openGroupFeedItem(getGroupFeedItem(entry))}
              />
            ) : entry.kind === 'feed' ? (
              <FeedItem
                key={`${entry.item.type}-${entry.item.id}`}
                item={entry.item}
                className="h-full"
                networkDegree={null}
                onOpenDetails={openGroupFeedItem}
                canOpenEventDashboardOverride={isFaculty}
                canDeleteOverride={isFaculty}
                onDeleteOverride={(entry.item.type === 'event' || entry.item.type === 'project')
                  ? unlinkGroupContent
                  : undefined}
                deleteActionLabel={(entry.item.type === 'event' || entry.item.type === 'project')
                  ? 'Remove from department'
                  : undefined}
                deleteDialogTitle={(entry.item.type === 'event' || entry.item.type === 'project')
                  ? `Remove this ${entry.item.type} from ${group.name}?`
                  : undefined}
                deleteDialogDescription={(entry.item.type === 'event' || entry.item.type === 'project')
                  ? `This removes the ${entry.item.type} from ${group.name} and makes it private to its creator.`
                  : undefined}
                deleteSuccessMessage={(entry.item.type === 'event' || entry.item.type === 'project')
                  ? `${entry.item.type === 'event' ? 'Event' : 'Project'} removed from ${group.name}`
                  : undefined}
                onDeleteSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['group-events', group?.id] });
                  queryClient.invalidateQueries({ queryKey: ['group-projects', group?.id] });
                  setSelectedItem(null);
                }}
              />
            ) : (() => {
              const p = entry.post;
              return (
              <Card
                key={p.id}
                className="h-full cursor-pointer"
                onClick={() => openGroupFeedItem(getGroupFeedItem(entry))}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.creator?.avatar_url || undefined} />
                        <AvatarFallback>{p.creator?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{p.creator?.display_name || 'Unknown'}</p>
                        {p.author_identity === 'group' && p.author_group_id === group.id && (
                          <p className="text-xs text-muted-foreground">Department post</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {(isFaculty || p.user_id === user?.id) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Post actions"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPostPendingRemoval(p);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                  {(() => {
                    const urls = p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [];
                    if (!urls.length) return null;

                    return (
                      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                        <ImageCarousel
                          urls={urls}
                          positionX={p.image_position_x ?? 50}
                          positionY={p.image_position_y ?? 50}
                          positionZoom={p.image_zoom ?? 1}
                          positions={p.image_positions}
                          className="h-full rounded-md"
                          imageClassName="h-full max-h-none object-cover"
                        />
                      </div>
                    );
                  })()}
                  <div className="pt-1">
                    <Badge variant="secondary" className="gap-1">
                      {p.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {p.visibility === 'public' ? 'Public' : 'Group Only'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              );
            })())}
            </div>
          )}
        </TabsContent>}

        <TabsContent value="auditions" className="mt-4">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Department auditions</h2>
            </div>
            {auditionsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading auditions...</p>
            ) : auditions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No published auditions yet.</p>
            ) : (
              <div className="space-y-4">
                {auditions.map((audition) => {
                  const availabilityBySlot = new Map(
                    auditionAvailability
                      .filter((row) => row.audition_id === audition.id)
                      .map((row) => [row.timeslot_id, row]),
                  );
                  const myTimeslot = auditionAvailability.find(
                    (row) => row.audition_id === audition.id && row.is_my_timeslot,
                  );

                  return (
                    <Card key={audition.id}>
                      <CardContent className="space-y-4 p-5">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{audition.title}</h3>
                            {myTimeslot && <Badge>Signed up</Badge>}
                          </div>
                          {audition.description && (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{audition.description}</p>
                          )}
                        </div>

                        {audition.materials && (
                          <div className="rounded-md border bg-muted/20 p-3 text-sm">
                            <p className="font-medium">Materials</p>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{audition.materials}</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Choose a timeslot</p>
                          {audition.group_audition_timeslots
                            .slice()
                            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                            .map((slot) => {
                              const availability = availabilityBySlot.get(slot.id);
                              const bookedCount = availability?.booked_count ?? 0;
                              const capacity = availability?.capacity ?? slot.capacity;
                              const remaining = Math.max(0, capacity - bookedCount);
                              const isSelected = availability?.is_my_timeslot ?? false;
                              const isFull = remaining === 0 && !isSelected;

                              return (
                                <div key={slot.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {new Date(slot.starts_at).toLocaleString()} - {new Date(slot.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                      <span><span className="font-medium text-foreground">Capacity:</span> {capacity}</span>
                                      <span className={isFull ? 'font-medium text-destructive' : ''}>
                                        <span className="font-medium text-foreground">Available:</span> {remaining}
                                        {isFull && ' (Full)'}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isSelected ? 'secondary' : 'default'}
                                    disabled={isSelected || isFull || bookAuditionTimeslot.isPending}
                                    onClick={() => bookAuditionTimeslot.mutate({ auditionId: audition.id, timeslotId: slot.id })}
                                  >
                                    {isSelected ? <><Check className="mr-1 h-4 w-4" /> Selected</> : myTimeslot ? 'Switch to this slot' : 'Reserve slot'}
                                  </Button>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Department resources</h2>
            </div>
            {resourcesLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading resources...</p>
            ) : resources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No published resources yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {resources.map((resource) => (
                  <Card key={resource.id} className="h-full">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium">{resource.title}</h3>
                          {resource.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
                          )}
                        </div>
                        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <Button asChild variant="outline" size="sm" className="mt-auto w-full gap-2">
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          Open resource
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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
                    {m.user_id !== user?.id && (
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              aria-label={`Message ${m.profile?.display_name || 'member'}`}
                              onClick={() => navigate(`/messages/direct/${m.user_id}`, {
                                state: { originRoute: `${location.pathname}?tab=members` },
                              })}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={8}
                            className="border-[hsl(45_95%_58%/0.18)] bg-[hsl(222_30%_12%)] px-2.5 py-1.5 text-xs text-white shadow-lg"
                          >
                            Message member
                          </TooltipContent>
                        </Tooltip>
                        {isFaculty && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive h-7 w-7"
                            aria-label={`Remove ${m.profile?.display_name || 'member'}`}
                            title="Remove member"
                            onClick={() => {
                              if (confirm('Remove this member?')) removeMember.mutate(m.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
        </section>

      <Dialog open={showPostCreator} onOpenChange={setShowPostCreator}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create a Post</DialogTitle>
          </DialogHeader>
          <PostCreator
            userProfile={{
              display_name:
                currentUserProfile?.display_name ||
                user?.user_metadata?.display_name ||
                user?.user_metadata?.full_name ||
                user?.email?.split('@')[0] ||
                'Personal account',
              avatar_url: currentUserProfile?.avatar_url || user?.user_metadata?.avatar_url || null,
            }}
            defaultGroupId={group.id}
            groupOnly
            onClose={() => setShowPostCreator(false)}
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['group-posts', group.id] });
              queryClient.invalidateQueries({ queryKey: ['group-events', group.id] });
              queryClient.invalidateQueries({ queryKey: ['group-projects', group.id] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && closeGroupDetails()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-left">Details</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <div className="mt-4 space-y-4 pb-8">
              <FeedItem
                item={selectedItem}
                networkDegree={null}
                canOpenEventDashboardOverride={isFaculty}
                canDeleteOverride={isFaculty}
                onDeleteOverride={(selectedItem.type === 'event' || selectedItem.type === 'project')
                  ? unlinkGroupContent
                  : undefined}
                deleteActionLabel={(selectedItem.type === 'event' || selectedItem.type === 'project')
                  ? 'Remove from department'
                  : undefined}
                deleteDialogTitle={(selectedItem.type === 'event' || selectedItem.type === 'project')
                  ? `Remove this ${selectedItem.type} from ${group.name}?`
                  : undefined}
                deleteDialogDescription={(selectedItem.type === 'event' || selectedItem.type === 'project')
                  ? `This removes the ${selectedItem.type} from ${group.name} and makes it private to its creator.`
                  : undefined}
                deleteSuccessMessage={(selectedItem.type === 'event' || selectedItem.type === 'project')
                  ? `${selectedItem.type === 'event' ? 'Event' : 'Project'} removed from ${group.name}`
                  : undefined}
                onDeleteSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['group-posts', group.id] });
                  queryClient.invalidateQueries({ queryKey: ['group-events', group.id] });
                  queryClient.invalidateQueries({ queryKey: ['group-projects', group.id] });
                  closeGroupDetails();
                }}
              />
              {(selectedItem.type === 'post' || selectedItem.type === 'job') && (
                <PostComments postId={selectedItem.id} postOwnerId={selectedItem.user_id} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={!!postPendingRemoval}
        onOpenChange={(open) => {
          if (!open) setPostPendingRemoval(null);
        }}
        onConfirm={() => {
          if (postPendingRemoval) deletePost.mutate(postPendingRemoval.id);
        }}
        title="Delete this post?"
        description="This will permanently delete this post. This action cannot be undone."
        isPending={deletePost.isPending}
      />

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
