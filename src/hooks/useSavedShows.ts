import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useSavedShows = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's saved show IDs
  const { data: savedShowIds = [], isLoading } = useQuery({
    queryKey: ['saved-show-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_shows')
        .select('show_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(s => s.show_id);
    },
    enabled: !!user?.id,
  });

  // Save show mutation
  const saveMutation = useMutation({
    mutationFn: async (showId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_shows')
        .insert({ user_id: user.id, show_id: showId });
      if (error) throw error;
    },
    onMutate: async (showId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-show-ids', user?.id] });
      const previous = queryClient.getQueryData<string[]>(['saved-show-ids', user?.id]);
      queryClient.setQueryData<string[]>(['saved-show-ids', user?.id], (old = []) => [...old, showId]);
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-show-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-saved-shows'] });
      toast.success('Added to your watchlist! 🎭');
    },
    onError: (_err, _showId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['saved-show-ids', user?.id], context.previous);
      }
      toast.error('Could not save show');
    },
  });

  // Unsave show mutation
  const unsaveMutation = useMutation({
    mutationFn: async (showId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_shows')
        .delete()
        .eq('user_id', user.id)
        .eq('show_id', showId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-show-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-saved-shows'] });
      toast.success('Removed from your show list');
    },
    onError: () => {
      toast.error('Could not remove show');
    },
  });

  const isSaved = (showId: string) => savedShowIds.includes(showId);

  const saveShow = (showId: string) => {
    if (!user) {
      toast.error('Sign in to save shows');
      return;
    }
    saveMutation.mutate(showId);
  };

  const unsaveShow = (showId: string) => {
    unsaveMutation.mutate(showId);
  };

  return {
    savedShowIds,
    isLoading,
    isSaved,
    saveShow,
    unsaveShow,
  };
};
