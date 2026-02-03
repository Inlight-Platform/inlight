import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useVouch = (targetUserId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user has vouched for target user
  const { data: hasVouched = false, isLoading: checkingVouch } = useQuery({
    queryKey: ['vouch-status', user?.id, targetUserId],
    queryFn: async () => {
      if (!user?.id || !targetUserId || user.id === targetUserId) return false;
      const { data, error } = await supabase
        .from('vouches')
        .select('id')
        .eq('voucher_id', user.id)
        .eq('vouched_for_id', targetUserId)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id && !!targetUserId && user.id !== targetUserId,
  });

  // Get vouch count for target user
  const { data: vouchCount = 0, isLoading: loadingCount } = useQuery({
    queryKey: ['vouch-count', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return 0;
      const { data, error } = await supabase
        .from('profiles')
        .select('vouch_count')
        .eq('user_id', targetUserId)
        .single();
      if (error) return 0;
      return data?.vouch_count || 0;
    },
    enabled: !!targetUserId,
  });

  // Vouch mutation - now accepts an optional message
  const vouchMutation = useMutation({
    mutationFn: async (message?: string) => {
      if (!user?.id || !targetUserId) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('vouches')
        .insert({ 
          voucher_id: user.id, 
          vouched_for_id: targetUserId,
          message: message?.trim() || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouch-status', user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['vouch-count', targetUserId] });
      toast.success('Vouched! Your endorsement helps this person stand out.');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('You already vouched for this person');
      } else {
        toast.error('Failed to vouch');
      }
    },
  });

  // Unvouch mutation
  const unvouchMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !targetUserId) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('vouches')
        .delete()
        .eq('voucher_id', user.id)
        .eq('vouched_for_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouch-status', user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['vouch-count', targetUserId] });
      toast.success('Vouch removed');
    },
    onError: () => toast.error('Failed to remove vouch'),
  });

  return {
    hasVouched,
    vouchCount,
    isLoading: checkingVouch || loadingCount,
    isPending: vouchMutation.isPending || unvouchMutation.isPending,
    vouch: vouchMutation.mutate,
    unvouch: unvouchMutation.mutate,
  };
};
