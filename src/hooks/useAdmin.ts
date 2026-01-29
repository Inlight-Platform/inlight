import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['admin-role', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('useAdmin: No user ID available');
        return false;
      }
      
      console.log('useAdmin: Checking admin role for user:', user.id);
      
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      if (error) {
        console.error('useAdmin: Error checking admin role:', error);
        return false;
      }
      
      console.log('useAdmin: has_role result:', data);
      return data === true;
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 0, // Always refetch to ensure fresh data
  });

  return {
    isAdmin: isAdmin ?? false,
    isLoading: isLoading || authLoading,
  };
}
