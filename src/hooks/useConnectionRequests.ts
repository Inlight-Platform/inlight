import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ConnectionRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export function useConnectionRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending requests received by the user
  const { data: pendingRequests = [], isLoading: loadingReceived } = useQuery({
    queryKey: ['connection-requests', 'received', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[ProfileDebug] pending connection requests query failed', {
          userId: user.id,
          error,
        });
        throw error;
      }
      console.log('[ProfileDebug] pending connection requests result', {
        userId: user.id,
        count: data?.length ?? 0,
        sample: (data || []).slice(0, 3),
      });
      return data as ConnectionRequest[];
    },
    enabled: !!user?.id,
  });

  // Fetch requests sent by the user
  const { data: sentRequests = [], isLoading: loadingSent } = useQuery({
    queryKey: ['connection-requests', 'sent', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[ProfileDebug] sent connection requests query failed', {
          userId: user.id,
          error,
        });
        throw error;
      }
      console.log('[ProfileDebug] sent connection requests result', {
        userId: user.id,
        count: data?.length ?? 0,
        sample: (data || []).slice(0, 3),
      });
      return data as ConnectionRequest[];
    },
    enabled: !!user?.id,
  });

  // Send a connection request
  const sendRequest = useMutation({
    mutationFn: async (receiverId: string) => {
      if (!user?.id) throw new Error('Must be logged in');

      const incomingRequest = pendingRequests.find((request) => request.sender_id === receiverId);
      if (incomingRequest) {
        const { error } = await supabase
          .from('connection_requests')
          .update({ status: 'accepted' })
          .eq('id', incomingRequest.id)
          .eq('receiver_id', user.id)
          .eq('status', 'pending');
        if (error) throw error;
        return;
      }

      const previousSentRequest = sentRequests.find((request) => request.receiver_id === receiverId);
      if (previousSentRequest?.status === 'pending') {
        return;
      }

      if (previousSentRequest) {
        const { error: deleteError } = await supabase
          .from('connection_requests')
          .delete()
          .eq('id', previousSentRequest.id)
          .eq('sender_id', user.id);
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase
        .from('connection_requests')
        .insert({ sender_id: user.id, receiver_id: receiverId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
    },
  });

  // Accept a connection request
  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('connection_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .eq('receiver_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
    },
  });

  // Reject a connection request
  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('connection_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .eq('receiver_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
    },
  });

  // Cancel a sent request
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('connection_requests')
        .delete()
        .eq('id', requestId)
        .eq('sender_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
    },
  });

  // Check if a request has been sent to a user
  const hasSentRequestTo = (userId: string) => 
    sentRequests.some(r => r.receiver_id === userId && r.status === 'pending');

  // Check if a request has been received from a user
  const hasReceivedRequestFrom = (userId: string) =>
    pendingRequests.some(r => r.sender_id === userId);

  return {
    pendingRequests,
    sentRequests,
    isLoading: loadingReceived || loadingSent,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    hasSentRequestTo,
    hasReceivedRequestFrom,
  };
}
