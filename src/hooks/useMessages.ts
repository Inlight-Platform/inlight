import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_message: Message;
  unread_count: number;
}

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all conversations - optimized with limited initial fetch
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch only recent messages (last 100) for faster initial load
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, read_at, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // Group messages by conversation partner
      const conversationMap = new Map<string, { lastMessage: Message; unread: number }>();
      
      messages.forEach((msg: Message) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, { lastMessage: msg, unread: 0 });
        }
        
        const conv = conversationMap.get(partnerId)!;
        if (msg.receiver_id === user.id && !msg.read_at) {
          conv.unread++;
        }
      });

      // Get partner profiles in batch
      const partnerIds = Array.from(conversationMap.keys());

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', partnerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build conversation list
      const convos: Conversation[] = [];
      conversationMap.forEach((data, partnerId) => {
        const profile = profileMap.get(partnerId);
        convos.push({
          user_id: partnerId,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          last_message: data.lastMessage,
          unread_count: data.unread,
        });
      });

      // Sort by last message time
      convos.sort((a, b) => 
        new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
      );

      return convos;
    },
    enabled: !!user?.id,
    staleTime: 10000, // Consider fresh for 10 seconds
    refetchInterval: 30000,
  });

  // Fetch messages for a specific conversation
  const useConversation = (partnerId: string | undefined) => {
    return useQuery({
      queryKey: ['conversation-messages', user?.id, partnerId],
      queryFn: async () => {
        if (!user?.id || !partnerId) return [];

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data as Message[];
      },
      enabled: !!user?.id && !!partnerId,
    });
  };

  // Total unread count
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', user?.id, variables.receiverId] });
    },
  });

  // Mark messages as read
  const markAsRead = useMutation({
    mutationFn: async (partnerId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Check if user can message another user
  const canMessage = useCallback(async (targetUserId: string): Promise<{ allowed: boolean; reason?: string }> => {
    if (!user?.id) return { allowed: false, reason: 'Not authenticated' };
    if (targetUserId === user.id) return { allowed: false, reason: 'Cannot message yourself' };

    // Get target user's message privacy setting
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('message_privacy')
      .eq('user_id', targetUserId)
      .single();

    const privacy = targetProfile?.message_privacy || 'mutuals_only';

    if (privacy === 'open') {
      return { allowed: true };
    }

    // Check if mutual connection exists
    const { data: mutuals } = await supabase
      .rpc('get_mutual_connections', { target_user_id: user.id });

    const isMutual = mutuals?.some((m: { user_id: string }) => m.user_id === targetUserId);

    if (isMutual) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'This user only accepts messages from mutual connections' };
  }, [user?.id]);

  return {
    conversations,
    loadingConversations,
    totalUnread,
    useConversation,
    sendMessage,
    markAsRead,
    canMessage,
  };
}
