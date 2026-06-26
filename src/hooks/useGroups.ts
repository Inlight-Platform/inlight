import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyGroup {
  id: string;
  slug: string;
  name: string;
  is_faculty: boolean;
}

/** Groups the current user belongs to or owns as faculty. */
export const useMyGroups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-groups', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data, error } = await (supabase.rpc as any)('get_my_groups');
      if (error) {
        console.error('get_my_groups failed', error);
        return [];
      }
      return (data || []) as MyGroup[];
    },
  });
};

/** First group where the user is the faculty owner (used for the "Manage Group" button). */
export const useMyFacultyGroup = () => {
  const { data: groups } = useMyGroups();
  return groups?.find((g) => g.is_faculty) ?? null;
};

/** Resolve a group by slug. Anyone can read group metadata. */
export const useGroupBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ['group-by-slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups' as any)
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; slug: string; name: string; description: string | null; faculty_owner_id: string | null } | null;
    },
  });
};