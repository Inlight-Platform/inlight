import React, { useState, useMemo } from 'react';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Filter, Plus, Calendar, FolderKanban, User, Users, Search, X, ArrowUpDown, Archive, Bookmark, BookmarkCheck, LayoutGrid, Rows } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { Button } from '@/components/ui/button';
import { PostCreator } from '@/components/feed/PostCreator';
import { FeedItem, FeedItemData } from '@/components/feed/FeedItem';
import { FeedBentoCard, getBentoSize } from '@/components/feed/FeedBentoCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { WelcomeMessage } from '@/components/feed/WelcomeMessage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type NetworkFilter = 'all' | '1st';
type ContentFilter = 'all' | 'events' | 'projects' | 'updates';
type ProjectSubTab = 'feed' | 'my-network' | 'saved' | 'archive';
type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';
type ViewMode = 'bento' | 'scroll';

const PROJECT_CATEGORIES = [
  { value: 'film', label: 'Film' },
  { value: 'theater', label: 'Theatre' },
  { value: 'music', label: 'Music' },
  { value: 'dance', label: 'Dance' },
  { value: 'photography', label: 'Photography' },
  { value: 'other', label: 'Other' },
] as const;

type ProjectCategory = typeof PROJECT_CATEGORIES[number]['value'];

const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItemData | null>(null);
  const { firstDegree, secondDegree, getConnectionDegree, isLoading: connectionsLoading } = useNetworkConnections();

  // Project-specific state
  const [projectSubTab, setProjectSubTab] = useState<ProjectSubTab>('feed');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('bento');

  // Fetch current user's profile
  const { data: userProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profileByUserId, error: profileByUserIdError } = await supabase
        .from('profiles_public')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileByUserIdError) {
        console.error('FeedPage: failed loading profile by user id', profileByUserIdError);
      }

      if (profileByUserId) {
        return profileByUserId;
      }

      return null;
    },
    enabled: !!user?.id
  });

  // Fetch posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['feed-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((post) => {
        const isJob = post.content.startsWith('🎯');
        return {
          ...post,
          type: isJob ? 'job' as const : 'post' as const,
          visibility: post.visibility,
          creator_profile: profileMap.get(post.user_id)
        };
      });
    }
  });

  // Fetch projects (all, including archived for the archive tab)
  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['feed-projects-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data.map((p) => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((project) => ({
        ...project,
        creator_profile: profileMap.get(project.creator_id)
      }));
    }
  });

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['feed-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set(data.map((e) => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((event) => ({
        id: event.id,
        type: 'event' as const,
        user_id: event.user_id,
        title: event.title,
        description: event.description,
        image_url: event.image_url,
        link_url: event.link_url,
        link_title: event.link_title,
        created_at: event.created_at,
        event_date: event.event_date,
        location: event.location,
        event_type: event.event_type,
        is_paid: event.is_paid,
        price: event.price,
        currency: event.currency,
        stripe_price_id: event.stripe_price_id,
        payment_link_url: (event as any).payment_link_url,
        creator_profile: profileMap.get(event.user_id)
      }));
    }
  });

  // Fetch open roles from projects
  const { data: openRoles = [], isLoading: openRolesLoading } = useQuery({
    queryKey: ['feed-open-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_roles')
        .select(`
          id,
          role_name,
          created_at,
          project_id,
          projects!inner (
            id,
            title,
            status,
            is_public,
            creator_id,
            main_image_url,
            header_image_url
          )
        `)
        .is('assigned_user_id', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const userIds = [...new Set(data.map((r) => (r.projects as any).creator_id))] as string[];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data
        .filter((role) => (role.projects as any).is_public)
        .map((role) => ({
          id: role.id,
          type: 'open_role' as const,
          user_id: (role.projects as any).creator_id,
          title: role.role_name,
          role_id: role.id,
          project_id: role.project_id,
          project_title: (role.projects as any).title,
          project_status: (role.projects as any).status,
          image_url: (role.projects as any).header_image_url || (role.projects as any).main_image_url,
          created_at: role.created_at,
          creator_profile: profileMap.get((role.projects as any).creator_id)
        }));
    }
  });

  // Fetch saved projects
  const { data: savedProjects = [] } = useQuery({
    queryKey: ['saved-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_projects')
        .select('id, project_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const savedProjectIds = new Set(savedProjects.map(s => s.project_id));

  // Save/unsave mutations
  const saveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_projects')
        .insert({ user_id: user.id, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      toast.success('Project saved!');
    },
    onError: () => toast.error('Failed to save project'),
  });

  const unsaveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_projects')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      toast.success('Project removed from saved');
    },
    onError: () => toast.error('Failed to remove project'),
  });

  const handleToggleSave = (projectId: string) => {
    if (savedProjectIds.has(projectId)) {
      unsaveProjectMutation.mutate(projectId);
    } else {
      saveProjectMutation.mutate(projectId);
    }
  };

  const navVioletButtonClass =
    "bg-gradient-to-r from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white shadow-lg shadow-[hsl(220_85%_55%/0.25)] hover:text-white hover:from-[hsl(220_85%_58%)] hover:to-[hsl(240_70%_53%)]";

  const navVioletOutlineClass =
    "border-[hsl(240_70%_50%/0.28)] bg-[hsl(240_70%_50%/0.08)] text-[hsl(222_35%_12%)] dark:text-[hsl(220_15%_86%)] hover:text-[hsl(222_35%_8%)] dark:hover:text-white hover:bg-[hsl(220_20%_92%)] dark:hover:bg-[hsl(220_30%_15%)] hover:border-[hsl(45_95%_58%/0.24)]";

  // Helper to normalize status
  const normalizeStatus = (s: string | null): string => {
    const statusMap: Record<string, string> = {
      'pre-production': 'planning',
      'in-production': 'active',
      'post-production': 'wrapping',
      'completed': 'archived',
    };
    return statusMap[s?.toLowerCase() || ''] || s || 'planning';
  };

  const getCategoryLabel = (category: string | null) => {
    return PROJECT_CATEGORIES.find(c => c.value === category)?.label || 'Other';
  };

  // Project filtering helpers
  const filterBySearch = <T extends { title: string; description?: string | null }>(list: T[]) => {
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter(p =>
      p.title.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  };

  const sortProjectList = <T extends { title: string; created_at: string }>(list: T[]) => {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'a-z': return a.title.localeCompare(b.title);
        case 'z-a': return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
  };

  // Network user IDs for "my network" tab
  const networkUserIds = useMemo(() => {
    const ids = new Set<string>();
    firstDegree.forEach(id => ids.add(id));
    secondDegree.forEach(id => ids.add(id));
    if (user?.id) ids.add(user.id);
    return ids;
  }, [firstDegree, secondDegree, user?.id]);

  // Filtered project lists for sub-tabs
  const activeProjects = allProjects.filter(p => normalizeStatus(p.status) !== 'archived');
  const archivedProjects = allProjects.filter(p => normalizeStatus(p.status) === 'archived');

  const applyProjectFilters = (list: typeof allProjects) => {
    let filtered = selectedCategory === 'all' ? list : list.filter(p => p.category === selectedCategory);
    return sortProjectList(filterBySearch(filtered));
  };

  const feedProjects = applyProjectFilters(activeProjects);
  const networkProjects = applyProjectFilters(activeProjects.filter(p => networkUserIds.has(p.creator_id)));
  const savedProjectsList = applyProjectFilters(allProjects.filter(p => savedProjectIds.has(p.id)));
  const archivedProjectsList = applyProjectFilters(archivedProjects);

  // Helper to convert project rows to FeedItemData for bento rendering
  const projectsToFeedItems = (list: typeof allProjects): FeedItemData[] =>
    list.map((project) => ({
      id: project.id,
      type: 'project' as const,
      user_id: project.creator_id,
      title: project.title,
      description: project.description,
      image_url: project.header_image_url || project.main_image_url,
      created_at: project.created_at,
      category: project.category,
      project_status: project.status,
      link_url: (project as any).link_url,
      link_title: (project as any).link_title,
      creator_profile: project.creator_profile,
    }));

  const renderProjectBento = (list: typeof allProjects) => (
    <div
      className="grid grid-cols-12 gap-4 sm:gap-5 auto-rows-[220px]"
      style={{ gridAutoFlow: 'dense' }}
    >
      {projectsToFeedItems(list).map((item, idx) => (
        <FeedBentoCard
          key={`project-${item.id}`}
          item={item}
          size={getBentoSize(idx)}
          onClick={() => navigate(`/projects/${item.id}`)}
        />
      ))}
    </div>
  );

  // Convert projects to feed items for grid display
  const projectFeedItems: FeedItemData[] = useMemo(() => {
    return activeProjects.map((project) => ({
      id: project.id,
      type: 'project' as const,
      user_id: project.creator_id,
      title: project.title,
      description: project.description,
      image_url: project.header_image_url || project.main_image_url,
      created_at: project.created_at,
      category: project.category,
      project_status: project.status,
      link_url: project.link_url,
      link_title: project.link_title,
      creator_profile: project.creator_profile
    }));
  }, [activeProjects]);

  // Combine and filter feed items (for non-project tabs)
  const feedItems = useMemo(() => {
    let allItems: FeedItemData[] = [...posts, ...projectFeedItems, ...events];

    if (contentFilter !== 'all') {
      allItems = allItems.filter((item) => {
        if (contentFilter === 'events') return item.type === 'event';
        if (contentFilter === 'projects') return item.type === 'project';
        if (contentFilter === 'updates') return item.type === 'post';
        return true;
      });
    }

    allItems.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (networkFilter !== 'all') {
      allItems = allItems.filter((item) => {
        if (item.user_id === user?.id) return true;
        const degree = getConnectionDegree(item.user_id);
        if (networkFilter === '1st') return degree === '1st';
        return true;
      });
    }

    if (feedSearchQuery.trim()) {
      const q = feedSearchQuery.toLowerCase();
      allItems = allItems.filter((item) => {
        const title = item.title?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';
        const content = item.content?.toLowerCase() || '';
        return title.includes(q) || desc.includes(q) || content.includes(q);
      });
    }

    return allItems;
  }, [posts, projectFeedItems, events, openRoles, networkFilter, contentFilter, feedSearchQuery, user?.id, getConnectionDegree]);

  const isLoading = postsLoading || projectsLoading || eventsLoading || openRolesLoading || connectionsLoading;

  const networkFilters: { value: NetworkFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All' },
    { value: '1st', label: 'My Network', count: firstDegree.length },
  ];

  const contentFilters: { value: ContentFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All', icon: <Filter className="h-4 w-4" /> },
    { value: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    { value: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
    { value: 'updates', label: 'Updates', icon: <User className="h-4 w-4" /> },
  ];

  const itemCounts = useMemo(() => ({
    events: events.length,
    projects: activeProjects.length,
    updates: posts.filter((p) => p.type === 'post').length,
  }), [events, posts, activeProjects]);

  // Project card component for sub-tabs
  const ProjectCard = ({ project }: { project: typeof allProjects[0] }) => {
    const isSaved = savedProjectIds.has(project.id);
    return (
      <Card
        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border"
        onClick={() => navigate(`/projects/${project.id}`)}
      >
        <div className="relative">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={project.creator_profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {project.creator_profile?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">
              {project.creator_profile?.display_name || 'Unknown'}
            </span>
          </div>

          {user && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSave(project.id);
              }}
              className="absolute top-3 right-3 z-10 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors"
            >
              {isSaved ? (
                <BookmarkCheck className="w-5 h-5 text-primary" />
              ) : (
                <Bookmark className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}

          {project.header_image_url ? (
            <img src={project.header_image_url} alt={project.title} className="w-full h-48 object-cover" />
          ) : project.main_image_url ? (
            <img src={project.main_image_url} alt={project.title} className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">{project.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {getCategoryLabel(project.category)}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render projects sub-content
  const renderProjectsContent = () => {
    if (contentFilter !== 'projects') return null;

    return (
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category Filters + Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 flex-1">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="flex-shrink-0"
            >
              All
            </Button>
            {PROJECT_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className="flex-shrink-0"
              >
                {cat.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="a-z">A → Z</SelectItem>
                <SelectItem value="z-a">Z → A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sub-tabs */}
        <Tabs value={projectSubTab} onValueChange={(v) => setProjectSubTab(v as ProjectSubTab)} className="w-full">
          <div className="overflow-x-auto scrollbar-thin -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 mb-4">
              <TabsTrigger value="feed" className="flex-shrink-0 whitespace-nowrap">All</TabsTrigger>
              <TabsTrigger value="saved" className="flex-shrink-0 whitespace-nowrap">Saved</TabsTrigger>
              <TabsTrigger value="archive" className="gap-1 flex-shrink-0 whitespace-nowrap">
                <Archive className="w-3 h-3" />
                Completed
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="feed">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : feedProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? `No projects found for "${searchQuery}"` : selectedCategory === 'all' ? 'No projects yet' : `No ${getCategoryLabel(selectedCategory)} projects yet`}
                </p>
              </div>
            ) : (
              renderProjectBento(feedProjects)
            )}
          </TabsContent>

          <TabsContent value="my-network">
            {!user ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Log in to see projects from your network</p>
                <Button onClick={() => navigate('/auth')} className="mt-4">Log In</Button>
              </div>
            ) : networkProjects.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? `No network projects found for "${searchQuery}"` : 'No projects from your network yet.'}
                </p>
              </div>
            ) : (
              renderProjectBento(networkProjects)
            )}
          </TabsContent>

          <TabsContent value="saved">
            {!user ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Log in to save projects</p>
                <Button onClick={() => navigate('/auth')} className="mt-4">Log In</Button>
              </div>
            ) : savedProjectsList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? `No saved projects found for "${searchQuery}"` : 'No saved projects yet'}
                </p>
              </div>
            ) : (
              renderProjectBento(savedProjectsList)
            )}
          </TabsContent>

          <TabsContent value="archive">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : archivedProjectsList.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? `No archived projects found for "${searchQuery}"` : 'No archived projects yet.'}
                </p>
              </div>
            ) : (
              renderProjectBento(archivedProjectsList)
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={inlightLogo}
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <h1 className="text-2xl font-display font-bold">Home</h1>
          </div>
          
          {user && (
            <Button onClick={() => setShowPostCreator(true)} className={`gap-2 ${navVioletButtonClass}`}>
              <Plus className="h-4 w-4" />
              Make a Post
            </Button>
          )}
        </div>
      </header>

      <div className="px-3 sm:px-6 lg:px-8 py-6 w-full overflow-x-hidden">
        <div className="max-w-5xl mx-auto w-full">
          <div className="w-full">
            {(() => {
              const count = Number(
                (typeof window !== 'undefined' && window.localStorage.getItem('inlight-login-count')) ?? '0'
              );
              return count <= 2 ? <WelcomeMessage /> : null;
            })()}

            {/* Content Type Filters */}
            <div className="mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {contentFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={contentFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentFilter(filter.value)}
                    className={`flex-shrink-0 gap-1.5 ${
                      contentFilter === filter.value ? navVioletButtonClass : navVioletOutlineClass
                    }`}
                  >
                    {filter.icon}
                    {filter.label}
                    {filter.value !== 'all' && itemCounts[filter.value as keyof typeof itemCounts] > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({itemCounts[filter.value as keyof typeof itemCounts]})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search Bar (for non-project tabs) */}
            {contentFilter !== 'projects' && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts, events, projects..."
                  value={feedSearchQuery}
                  onChange={(e) => setFeedSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {feedSearchQuery && (
                  <button
                    onClick={() => setFeedSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* Show project sub-content when on projects tab */}
            {contentFilter === 'projects' ? (
              renderProjectsContent()
            ) : (
              <>
                {/* Feed Items */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : feedItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {contentFilter !== 'all'
                        ? `No ${contentFilter} found.`
                        : networkFilter === 'all'
                        ? 'No posts or projects yet. Be the first to share!'
                        : `No content from your ${networkFilter === '1st' ? 'network' : networkFilter + ' degree connections'} yet.`}
                    </p>
                    {user && (
                      <Button onClick={() => setShowPostCreator(true)} className={`mt-4 gap-2 ${navVioletButtonClass}`}>
                        <Plus className="h-4 w-4" />
                        Create a post
                      </Button>
                    )}
                    {!user && (
                      <Button onClick={() => navigate('/auth')} className="mt-4">
                        Log in to post
                      </Button>
                    )}
                  </div>
                ) : (
                  <div
                    className="grid grid-cols-12 gap-4 sm:gap-5 auto-rows-[220px]"
                    style={{ gridAutoFlow: 'dense' }}
                  >
                    {feedItems.map((item, idx) => (
                      <FeedBentoCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        size={getBentoSize(idx)}
                       onClick={() => {
                          if (item.type === 'project') {
                            navigate(`/projects/${item.id}`);
                          } else if (item.type === 'event') {
                            setSelectedItem(item);
                          } else if (item.type === 'show') {
                            navigate('/stage-whisper');
                          } else if (item.type === 'open_role' && item.project_id) {
                            navigate(`/projects/${item.project_id}`);
                          } else if (item.type === 'job') {
                            navigate('/opportunities');
                          } else if (item.user_id) {
                            navigate(`/profile/${item.user_id}`);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Post Creator Dialog */}
      <Dialog open={showPostCreator} onOpenChange={setShowPostCreator}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a Post</DialogTitle>
          </DialogHeader>
          <PostCreator
            userProfile={userProfile || undefined}
            defaultOpen={true}
            onClose={() => setShowPostCreator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Expanded Item Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Details</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <div className="mt-4">
              <FeedItem
                item={selectedItem}
                networkDegree={selectedItem.user_id === user?.id ? null : getConnectionDegree(selectedItem.user_id)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default FeedPage;
