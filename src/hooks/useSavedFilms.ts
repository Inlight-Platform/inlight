import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useSavedFilms = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedFilmIds = [], isLoading } = useQuery({
    queryKey: ['saved-film-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_films')
        .select('film_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(s => s.film_id);
    },
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (filmId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_films')
        .insert({ user_id: user.id, film_id: filmId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-film-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-saved-films'] });
      toast.success('Added to your film list! 🎬');
    },
    onError: () => {
      toast.error('Could not save film');
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (filmId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_films')
        .delete()
        .eq('user_id', user.id)
        .eq('film_id', filmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-film-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-saved-films'] });
      toast.success('Removed from your film list');
    },
    onError: () => {
      toast.error('Could not remove film');
    },
  });

  const isFilmSaved = (filmId: string) => savedFilmIds.includes(filmId);

  const saveFilm = (filmId: string) => {
    if (!user) {
      toast.error('Sign in to save films');
      return;
    }
    saveMutation.mutate(filmId);
  };

  const unsaveFilm = (filmId: string) => {
    unsaveMutation.mutate(filmId);
  };

  return {
    savedFilmIds,
    isLoading,
    isFilmSaved,
    saveFilm,
    unsaveFilm,
  };
};
