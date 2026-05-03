import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type NetworkDegree = '1st' | '2nd' | '3rd+';

export const useNetworkConnections = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch 1st degree (mutual) connections
  const { data: firstDegree = [], isLoading: loading1st } = useQuery({
    queryKey: ['connections', '1st', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .rpc('get_mutual_connections', { target_user_id: user.id });
      if (error) {
        console.error('[ProfileDebug] get_mutual_connections failed', { userId: user.id, error });
        throw error;
      }
      console.log('[ProfileDebug] get_mutual_connections result', {
        userId: user.id,
        sample: (data || []).slice(0, 5),
      });
      return (data || []).map((d: { user_id: string }) => d.user_id);
    },
    enabled: !!user?.id,
  });

  // Fetch 2nd degree connections
  const { data: secondDegree = [], isLoading: loading2nd } = useQuery({
    queryKey: ['connections', '2nd', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .rpc('get_2nd_degree_connections', { target_user_id: user.id });
      if (error) {
        console.error('[ProfileDebug] get_2nd_degree_connections failed', { userId: user.id, error });
        throw error;
      }
      console.log('[ProfileDebug] get_2nd_degree_connections result', {
        userId: user.id,
        sample: (data || []).slice(0, 5),
      });
      return (data || []).map((d: { user_id: string }) => d.user_id);
    },
    enabled: !!user?.id,
  });

  // Check if current user is following a specific user
  const { data: following = [] } = useQuery({
    queryKey: ['following', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('connections')
        .select('following_id')
        .eq('follower_id', user.id);
      if (error) throw error;
      return data.map(d => d.following_id);
    },
    enabled: !!user?.id,
  });

  // Check who is following current user
  const { data: followers = [] } = useQuery({
    queryKey: ['followers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('connections')
        .select('follower_id')
        .eq('following_id', user.id);
      if (error) throw error;
      return data.map(d => d.follower_id);
    },
    enabled: !!user?.id,
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('connections')
        .insert({ follower_id: user.id, following_id: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  const isFollowing = (userId: string) => following.includes(userId);
  const isFollower = (userId: string) => followers.includes(userId);
  const isMutual = (userId: string) => firstDegree.includes(userId);

  const getConnectionDegree = (userId: string): NetworkDegree | null => {
    if (firstDegree.includes(userId)) return '1st';
    if (secondDegree.includes(userId)) return '2nd';
    return '3rd+';
  };

  return {
    firstDegree,
    secondDegree,
    following,
    followers,
    isLoading: loading1st || loading2nd,
    isFollowing,
    isFollower,
    isMutual,
    getConnectionDegree,
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
    isFollowPending: followMutation.isPending,
    isUnfollowPending: unfollowMutation.isPending,
  };
};
