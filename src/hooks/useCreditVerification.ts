import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CreditVouch {
  id: string;
  credit_id: string;
  voucher_id: string;
  created_at: string;
}

interface VerificationRequest {
  id: string;
  credit_id: string;
  user_id: string;
  materials_urls: string[];
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCreditVouches(creditId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get vouches for a specific credit
  const { data: vouches = [], isLoading } = useQuery({
    queryKey: ['credit-vouches', creditId],
    queryFn: async () => {
      if (!creditId) return [];
      const { data, error } = await supabase
        .from('credit_vouches')
        .select('*')
        .eq('credit_id', creditId);
      if (error) throw error;
      return data as CreditVouch[];
    },
    enabled: !!creditId,
  });

  // Check if current user has vouched
  const hasVouched = vouches.some(v => v.voucher_id === user?.id);
  const vouchCount = vouches.length;

  // Add vouch mutation
  const vouchMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !creditId) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('credit_vouches')
        .insert({ credit_id: creditId, voucher_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-vouches', creditId] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Vouched for this credit!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('You already vouched for this credit');
      } else {
        toast.error('Failed to vouch');
      }
    },
  });

  // Remove vouch mutation
  const unvouchMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !creditId) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('credit_vouches')
        .delete()
        .eq('credit_id', creditId)
        .eq('voucher_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-vouches', creditId] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Vouch removed');
    },
    onError: () => toast.error('Failed to remove vouch'),
  });

  return {
    vouches,
    hasVouched,
    vouchCount,
    isLoading,
    vouch: vouchMutation.mutate,
    unvouch: unvouchMutation.mutate,
    isPending: vouchMutation.isPending || unvouchMutation.isPending,
  };
}

export function useVerificationRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user's own verification requests
  const { data: myRequests = [], isLoading } = useQuery({
    queryKey: ['my-verification-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('credit_verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VerificationRequest[];
    },
    enabled: !!user?.id,
  });

  // Submit verification request
  const submitRequest = useMutation({
    mutationFn: async ({ creditId, materialsUrls, notes }: { creditId: string; materialsUrls: string[]; notes: string }) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('credit_verification_requests')
        .insert({
          credit_id: creditId,
          user_id: user.id,
          materials_urls: materialsUrls,
          notes,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-verification-requests', user?.id] });
      toast.success('Verification request submitted!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit request');
    },
  });

  // Cancel pending request
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('credit_verification_requests')
        .delete()
        .eq('id', requestId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-verification-requests', user?.id] });
      toast.success('Request cancelled');
    },
    onError: () => toast.error('Failed to cancel request'),
  });

  return {
    myRequests,
    isLoading,
    submitRequest: submitRequest.mutate,
    cancelRequest: cancelRequest.mutate,
    isSubmitting: submitRequest.isPending,
  };
}

// Admin hook for managing verification requests
export function useAdminVerificationRequests() {
  const queryClient = useQueryClient();

  // Get all pending verification requests
  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: ['admin-verification-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_verification_requests')
        .select(`
          *,
          credits!inner(id, project, role, year, company, user_id)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Approve request
  const approveRequest = useMutation({
    mutationFn: async ({ requestId, adminNotes }: { requestId: string; adminNotes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      // Get the credit ID from the request
      const { data: request, error: fetchError } = await supabase
        .from('credit_verification_requests')
        .select('credit_id')
        .eq('id', requestId)
        .single();
      
      if (fetchError) throw fetchError;

      // Update the request status
      const { error: updateError } = await supabase
        .from('credit_verification_requests')
        .update({
          status: 'approved',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Mark the credit as verified
      const { error: creditError } = await supabase
        .from('credits')
        .update({ verified: true })
        .eq('id', request.credit_id);

      if (creditError) throw creditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verification-requests'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Request approved and credit verified!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve request');
    },
  });

  // Deny request
  const denyRequest = useMutation({
    mutationFn: async ({ requestId, adminNotes }: { requestId: string; adminNotes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('credit_verification_requests')
        .update({
          status: 'denied',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verification-requests'] });
      toast.success('Request denied');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deny request');
    },
  });

  return {
    pendingRequests,
    isLoading,
    approveRequest: approveRequest.mutate,
    denyRequest: denyRequest.mutate,
    isApproving: approveRequest.isPending,
    isDenying: denyRequest.isPending,
  };
}

// Check if user shares a project with the credit owner
export function useCanVouchForCredit(creditOwnerId: string | undefined) {
  const { user } = useAuth();

  const { data: canVouch = false } = useQuery({
    queryKey: ['can-vouch-credit', user?.id, creditOwnerId],
    queryFn: async () => {
      if (!user?.id || !creditOwnerId || user.id === creditOwnerId) return false;

      // Get projects where current user is a member
      const { data: myProjects, error: myError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (myError || !myProjects?.length) return false;

      const myProjectIds = myProjects.map(p => p.project_id).filter(Boolean);

      if (myProjectIds.length === 0) return false;

      // Check if credit owner is a member of any of these projects
      const { data: sharedProjects, error: sharedError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', creditOwnerId)
        .in('project_id', myProjectIds);

      if (sharedError) return false;

      // Also check if either user is creator of shared projects
      if (sharedProjects && sharedProjects.length > 0) return true;

      // Check if current user is creator of projects where credit owner is member
      const { data: createdProjects, error: creatorError } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user.id);

      if (creatorError || !createdProjects?.length) return false;

      const createdProjectIds = createdProjects
        .map(p => p?.id)
        .filter(Boolean);

      if (createdProjectIds.length === 0) return false;

      const { data: ownerInMyProjects } = await supabase
        .from('project_members')
        .select('id')
        .eq('user_id', creditOwnerId)
        .in('project_id', createdProjectIds)
        .limit(1);

      if (ownerInMyProjects && ownerInMyProjects.length > 0) return true;

      // Check if credit owner is creator of projects where current user is member
      const { data: ownerCreatedProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', creditOwnerId);

      if (!ownerCreatedProjects?.length) return false;

      const ownerCreatedIds = ownerCreatedProjects
        .map(p => p?.id)
        .filter(Boolean);

      if (ownerCreatedIds.length === 0) return false;

      const { data: meInOwnerProjects } = await supabase
        .from('project_members')
        .select('id')
        .eq('user_id', user.id)
        .in('project_id', ownerCreatedIds)
        .limit(1);

      return !!(meInOwnerProjects && meInOwnerProjects.length > 0);
    },
    enabled: !!user?.id && !!creditOwnerId && user.id !== creditOwnerId,
  });

  return canVouch;
}
