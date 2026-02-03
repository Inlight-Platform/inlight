import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Calendar, Briefcase, FolderKanban, User, LayoutGrid, Users, Theater } from 'lucide-react';
import inlightLogo from '@/assets/inlight-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { Button } from '@/components/ui/button';
import { PostCreator } from '@/components/feed/PostCreator';
import { FeedItem, FeedItemData } from '@/components/feed/FeedItem';
import { ConnectionSuggestions } from '@/components/feed/ConnectionSuggestions';
import CreativeConnection from '@/components/feed/CreativeConnection';
import { WelcomeMessage } from '@/components/feed/WelcomeMessage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type NetworkFilter = 'all' | '1st';
type ContentFilter = 'all' | 'events' | 'jobs' | 'projects' | 'updates' | 'shows';

const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [showPostCreator, setShowPostCreator] = useState(false);
  const { firstDegree, getConnectionDegree, isLoading: connectionsLoading } = useNetworkConnections();

  // Fetch current user's profile
  const { data: userProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
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

      // Get creator profiles
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(post => {
        // Check if it's a job post (starts with job emoji)
        const isJob = post.content.startsWith('🎯');
        return {
          ...post,
          type: isJob ? 'job' as const : 'post' as const,
          creator_profile: profileMap.get(post.user_id),
        };
      });
    },
  });

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['feed-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Get creator profiles
      const userIds = [...new Set(data.map(p => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(project => ({
        id: project.id,
        type: 'project' as const,
        user_id: project.creator_id,
        title: project.title,
        description: project.description,
        image_url: project.main_image_url,
        created_at: project.created_at,
        category: project.category,
        creator_profile: profileMap.get(project.creator_id),
      }));
    },
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

      // Get creator profiles
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(event => ({
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
        creator_profile: profileMap.get(event.user_id),
      }));
    },
  });

  // Fetch shows (user-submitted off-off-broadway shows)
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ['feed-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nyc_shows')
        .select('*')
        .not('submitted_by', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Get creator profiles
      const userIds = [...new Set(data.map(s => s.submitted_by).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(show => ({
        id: show.id,
        type: 'show' as const,
        user_id: show.submitted_by!,
        title: show.title,
        description: show.description,
        image_url: show.poster_url,
        created_at: show.created_at,
        venue: show.venue,
        borough: show.borough,
        show_type: show.show_type,
        category: show.category,
        run_start: show.run_start,
        run_end: show.run_end,
        is_anonymous: show.is_anonymous || false,
        creator_profile: show.is_anonymous ? { display_name: null, avatar_url: null } : profileMap.get(show.submitted_by!),
      }));
    },
  });

  // Fetch open roles from projects
  const { data: openRoles = [], isLoading: openRolesLoading } = useQuery({
    queryKey: ['feed-open-roles'],
    queryFn: async () => {
      // Get open roles from public projects
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
            main_image_url
          )
        `)
        .is('assigned_user_id', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      // Get creator profiles
      const userIds = [...new Set(data.map(r => (r.projects as any).creator_id))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data
        .filter(role => (role.projects as any).is_public)
        .map(role => ({
          id: role.id,
          type: 'open_role' as const,
          user_id: (role.projects as any).creator_id,
          title: role.role_name,
          role_id: role.id,
          project_id: role.project_id,
          project_title: (role.projects as any).title,
          project_status: (role.projects as any).status,
          image_url: (role.projects as any).main_image_url,
          created_at: role.created_at,
          creator_profile: profileMap.get((role.projects as any).creator_id),
        }));
    },
  });

  // Combine and filter feed items
  const feedItems = useMemo(() => {
    let allItems: FeedItemData[] = [...posts, ...projects, ...events, ...shows, ...openRoles];
    
    // Filter by content type
    if (contentFilter !== 'all') {
      allItems = allItems.filter(item => {
        if (contentFilter === 'events') return item.type === 'event';
        if (contentFilter === 'jobs') return item.type === 'job' || item.type === 'open_role';
        if (contentFilter === 'projects') return item.type === 'project';
        if (contentFilter === 'updates') return item.type === 'post';
        if (contentFilter === 'shows') return item.type === 'show';
        return true;
      });
    }

    // Sort by created_at
    allItems.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Filter by network degree
    if (networkFilter === 'all') {
      return allItems;
    }

    return allItems.filter(item => {
      // Don't filter own content
      if (item.user_id === user?.id) return true;
      
      const degree = getConnectionDegree(item.user_id);
      if (networkFilter === '1st') return degree === '1st';
      return true;
    });
  }, [posts, projects, events, shows, openRoles, networkFilter, contentFilter, user?.id, getConnectionDegree]);

  const isLoading = postsLoading || projectsLoading || eventsLoading || showsLoading || openRolesLoading || connectionsLoading;

  const networkFilters: { value: NetworkFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All' },
    { value: '1st', label: 'My Network', count: firstDegree.length },
  ];

  const contentFilters: { value: ContentFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All', icon: <LayoutGrid className="h-4 w-4" /> },
    { value: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    { value: 'jobs', label: 'Opportunities', icon: <Briefcase className="h-4 w-4" /> },
    { value: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
    { value: 'updates', label: 'Updates', icon: <User className="h-4 w-4" /> },
    { value: 'shows', label: 'Shows', icon: <Theater className="h-4 w-4" /> },
  ];

  // Count items by type
  const itemCounts = useMemo(() => ({
    events: events.length,
    jobs: posts.filter(p => p.type === 'job').length + openRoles.length,
    projects: projects.length,
    updates: posts.filter(p => p.type === 'post').length,
    shows: shows.length,
  }), [events, posts, projects, shows, openRoles]);

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={inlightLogo} 
                alt="Home" 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[hsl(45_95%_58%/0.3)]"
              />
              <div className="absolute inset-0 blur-lg bg-[hsl(45_95%_58%/0.2)] -z-10 rounded-full" />
            </div>
            <h1 className="text-2xl font-display font-bold">Home</h1>
          </div>
          
          {user && (
            <Button 
              onClick={() => setShowPostCreator(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Make a Post
            </Button>
          )}
        </div>
      </header>

      <div className="px-3 sm:px-6 lg:px-8 py-6 w-full overflow-x-hidden">
        <div className="flex gap-3 max-w-4xl mx-auto w-full">
          {/* Left Sidebar - Connection Suggestions */}
          {user && (
            <div className="hidden lg:block flex-shrink-0">
              <div className="sticky top-24">
                <ConnectionSuggestions />
              </div>
            </div>
          )}

          {/* Main Feed Content */}
          <div className="flex-1 min-w-0 max-w-full lg:max-w-2xl mx-auto">
            {/* Welcome Message */}
            <WelcomeMessage />
            
            {/* Creative Connection */}
            {user && <CreativeConnection />}

            {/* Content Type Filters */}
            <div className="mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {contentFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={contentFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentFilter(filter.value)}
                    className="flex-shrink-0 gap-1.5"
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

            {/* Network Filters */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground flex-shrink-0">From:</span>
              {networkFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={networkFilter === filter.value ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setNetworkFilter(filter.value)}
                  className="flex-shrink-0"
                >
                  {filter.label}
                  {filter.count !== undefined && filter.count > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">({filter.count})</span>
                  )}
                </Button>
              ))}
            </div>

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
              <Button onClick={() => setShowPostCreator(true)} className="mt-4 gap-2">
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
          <div className="space-y-4">
            {feedItems.map((item) => (
              <FeedItem 
                key={`${item.type}-${item.id}`} 
                item={item}
                networkDegree={item.user_id === user?.id ? null : getConnectionDegree(item.user_id)}
              />
            ))}
          </div>
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
    </div>
  );
};

export default FeedPage;