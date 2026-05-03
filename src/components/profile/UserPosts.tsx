import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FeedItem, FeedItemData } from '@/components/feed/FeedItem';

interface UserPostsProps {
  userId: string;
}

export const UserPosts: React.FC<UserPostsProps> = ({ userId }) => {
  const navigate = useNavigate();

  // Fetch all posts by this user
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      // Fetch regular posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch events by this user
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch open roles from user's projects
      const { data: openRolesData, error: openRolesError } = await supabase
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
        .order('created_at', { ascending: false });

      if (openRolesError) throw openRolesError;

      // Filter to only this user's projects
      const userOpenRoles = (openRolesData || []).filter(
        role => role?.id && role?.projects && (role.projects as any).creator_id === userId && (role.projects as any).is_public
      );

      // Fetch user profile for creator info
      const { data: profile } = await supabase
        .from('profiles_public')
        .select('display_name, avatar_url')
        .eq('user_id', userId)
        .single();

      // Transform posts to FeedItemData format
      const transformedPosts: FeedItemData[] = (postsData || []).filter(post => !!post?.id).map((post) => ({
        id: post.id,
        type: post.link_url?.includes('job') || post.content?.toLowerCase().includes('hiring') ? 'job' : 'post',
        user_id: post.user_id,
        content: post.content,
        image_url: post.image_url,
        link_url: post.link_url,
        link_title: post.link_title,
        created_at: post.created_at,
        creator_profile: profile ? {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        } : undefined,
      }));

      // Transform events to FeedItemData format
      const transformedEvents: FeedItemData[] = (eventsData || []).filter(event => !!event?.id).map((event) => ({
        id: event.id,
        type: 'event' as const,
        user_id: event.user_id,
        title: event.title,
        description: event.description,
        content: event.description,
        image_url: event.image_url,
        link_url: event.link_url,
        link_title: event.link_title,
        event_date: event.event_date,
        location: event.location,
        event_type: event.event_type,
        created_at: event.created_at,
        creator_profile: profile ? {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        } : undefined,
      }));

      // Transform open roles to FeedItemData format
      const transformedOpenRoles: FeedItemData[] = userOpenRoles.map((role) => ({
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
        creator_profile: profile ? {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        } : undefined,
      }));

      // Combine and sort by created_at
      const allPosts = [...transformedPosts, ...transformedEvents, ...transformedOpenRoles];
      allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return allPosts;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {posts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No posts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedItem key={post.id} item={post} networkDegree={null} />
          ))}
        </div>
      )}
    </div>
  );
};
