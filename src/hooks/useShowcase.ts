import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ShowcaseProfile {
  id: string;
  user_id: string;
  program_name: string;
  program_slug: string;
  is_active: boolean;
  headshot_url: string | null;
  reel_url: string | null;
  resume_url: string | null;
  bio_override: string | null;
  first_name: string | null;
  last_name: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Joined from profiles_public
  display_name?: string;
  stage_name?: string;
  avatar_url?: string;
  role?: string;
  skills?: string[];
  graduation_year?: number;
}

export const useShowcaseByProgram = (programSlug: string | undefined) => {
  return useQuery({
    queryKey: ['showcase', programSlug],
    queryFn: async () => {
      if (!programSlug) return [];
      const { data, error } = await supabase
        .from('showcase_profiles')
        .select('*')
        .eq('program_slug', programSlug)
        .eq('is_active', true)
        .order('last_name', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Fetch profile data for each user
      const userIds = data.map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, stage_name, avatar_url, role, skills, graduation_year')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return data.map((sp: any) => ({
        ...sp,
        ...(profileMap.get(sp.user_id) || {}),
      })) as ShowcaseProfile[];
    },
    enabled: !!programSlug,
  });
};

export const useShowcaseProgram = (programSlug: string | undefined) => {
  return useQuery({
    queryKey: ['showcase-program', programSlug],
    queryFn: async () => {
      if (!programSlug) return null;
      const { data, error } = await supabase
        .from('showcase_programs')
        .select('*')
        .eq('slug', programSlug)
        .eq('is_active', true)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!programSlug,
  });
};

export const useMyShowcaseProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['my-showcase-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('showcase_profiles')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as ShowcaseProfile[];
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (profile: Partial<ShowcaseProfile> & { program_name: string; program_slug: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('showcase_profiles')
        .upsert({
          user_id: user.id,
          ...profile,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id,program_slug' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-showcase-profile'] });
      queryClient.invalidateQueries({ queryKey: ['showcase'] });
      toast.success('Showcase profile updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update showcase profile');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('showcase_profiles')
        .delete()
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-showcase-profile'] });
      queryClient.invalidateQueries({ queryKey: ['showcase'] });
      toast.success('Profile deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete profile');
    },
  });

  return {
    profiles: profileQuery.data || [],
    isLoading: profileQuery.isLoading,
    upsert: upsertMutation.mutateAsync,
    isUpdating: upsertMutation.isPending,
    deleteProfile: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
