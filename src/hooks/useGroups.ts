import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyGroup {
  id: string;
  slug: string;
  name: string;
  /** Backward-compatible name for scoped group-admin access. */
  is_faculty: boolean;
  members_can_post: boolean;
}

/** Groups the current user belongs to or can administer. */
export const useMyGroups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-groups', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data, error } = await supabase.rpc('get_my_groups');
      if (error) {
        console.error('get_my_groups failed', error);
        return [];
      }
      const groups = (data || []) as Omit<MyGroup, 'members_can_post'>[];
      if (!groups.length) return [];

      const { data: settings, error: settingsError } = await supabase
        .from('groups')
        .select('id, members_can_post')
        .in('id', groups.map((group) => group.id));
      if (settingsError) throw settingsError;

      const postingByGroup = new Map(
        (settings || []).map((group) => [group.id, group.members_can_post]),
      );
      return groups.map((group) => ({
        ...group,
        members_can_post: postingByGroup.get(group.id) ?? true,
      }));
    },
  });
};

/** Groups where the current user has direct scoped group-admin access. */
export const useMyScopedAdminGroups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-scoped-admin-groups', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Omit<MyGroup, 'is_faculty' | 'members_can_post'>[]> => {
      const { data, error } = await supabase.rpc('get_my_scoped_admin_groups');
      if (!error) {
        return (data || []) as Omit<MyGroup, 'is_faculty' | 'members_can_post'>[];
      }

      console.error('get_my_scoped_admin_groups failed', error);
      throw error;
    },
  });
};

/** First group where the user is a scoped group admin (used for the "Manage Group" button). */
export const useMyFacultyGroup = () => {
  const { data: groups } = useMyScopedAdminGroups();
  return groups?.[0] ?? null;
};

/** Resolve a group by slug. Anyone can read group metadata. */
export const useGroupBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ['group-by-slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        faculty_owner_id: string | null;
        is_listed: boolean;
        members_can_post: boolean;
      } | null;
    },
  });
};
