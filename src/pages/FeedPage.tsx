import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Users, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections, NetworkDegree } from '@/hooks/useNetworkConnections';
import { Button } from '@/components/ui/button';
import { PostCreator } from '@/components/feed/PostCreator';
import { FeedItem, FeedItemData } from '@/components/feed/FeedItem';

type NetworkFilter = 'all' | '1st' | '2nd' | '3rd+';

const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
  const { firstDegree, secondDegree, getConnectionDegree, isLoading: connectionsLoading } = useNetworkConnections();

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

      return data.map(post => ({
        ...post,
        type: 'post' as const,
        creator_profile: profileMap.get(post.user_id),
      }));
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
        created_at: event.created_at,
        event_date: event.event_date,
        location: event.location,
        event_type: event.event_type,
        creator_profile: profileMap.get(event.user_id),
      }));
    },
  });

  // Combine and filter feed items
  const feedItems = useMemo(() => {
    const allItems: FeedItemData[] = [...posts, ...projects, ...events];
    
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
      if (networkFilter === '2nd') return degree === '2nd';
      if (networkFilter === '3rd+') return degree === '3rd+';
      return true;
    });
  }, [posts, projects, events, networkFilter, user?.id, getConnectionDegree]);

  const isLoading = postsLoading || projectsLoading || eventsLoading || connectionsLoading;

  const networkFilters: { value: NetworkFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All' },
    { value: '1st', label: 'My Network', count: firstDegree.length },
    { value: '2nd', label: '2nd', count: secondDegree.length },
    { value: '3rd+', label: '3rd and more' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Back to home"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-bold">Feed</h1>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto">
        {/* Network Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {networkFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={networkFilter === filter.value ? 'default' : 'outline'}
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

        {/* Post Creator */}
        {user && (
          <div className="mb-6">
            <PostCreator userProfile={userProfile || undefined} />
          </div>
        )}

        {/* Feed Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {networkFilter === 'all' 
                ? 'No posts or projects yet. Be the first to share!'
                : `No content from your ${networkFilter === '1st' ? 'network' : networkFilter + ' degree connections'} yet.`}
            </p>
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
      </main>
    </div>
  );
};

export default FeedPage;
