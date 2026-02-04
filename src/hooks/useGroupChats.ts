import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

interface GroupChat {
  id: string;
  name: string;
  project_id: string;
  updated_at: string;
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender_name?: string;
    created_at: string;
  };
  unread_count: number;
}

interface GroupMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useGroupChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all group chats the user is a member of - optimized
  const { data: groupChats = [], isLoading: loadingGroupChats } = useQuery({
    queryKey: ['group-chats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get group chats where user is a member
      const { data: memberships, error: membershipError } = await supabase
        .from('group_chat_members')
        .select('group_chat_id')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;
      if (!memberships || memberships.length === 0) return [];

      const groupChatIds = memberships.map(m => m.group_chat_id);

      // Get group chat details
      const { data: chats, error: chatsError } = await supabase
        .from('project_group_chats')
        .select('*')
        .in('id', groupChatIds)
        .order('updated_at', { ascending: false });

      if (chatsError) throw chatsError;
      if (!chats || chats.length === 0) return [];

      // Batch fetch last messages for all chats at once
      const { data: allLastMessages } = await supabase
        .from('group_chat_messages')
        .select('id, group_chat_id, content, sender_id, created_at')
        .in('group_chat_id', groupChatIds)
        .order('created_at', { ascending: false });

      // Get unique last message per chat
      const lastMessageMap = new Map<string, typeof allLastMessages[0]>();
      allLastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.group_chat_id)) {
          lastMessageMap.set(msg.group_chat_id, msg);
        }
      });

      // Batch fetch sender profiles
      const senderIds = [...new Set(
        Array.from(lastMessageMap.values()).map(m => m.sender_id)
      )];
      
      const { data: senderProfiles } = senderIds.length > 0 
        ? await supabase
            .from('profiles_public')
            .select('user_id, display_name')
            .in('user_id', senderIds)
        : { data: [] };

      const profileMap = new Map<string, string | null>(
        senderProfiles?.map(p => [p.user_id, p.display_name] as [string, string | null]) || []
      );

      // Build group chats with messages
      const groupChatsWithMessages: GroupChat[] = chats.map(chat => {
        const lastMessage = lastMessageMap.get(chat.id);
        return {
          id: chat.id,
          name: chat.name,
          project_id: chat.project_id,
          updated_at: chat.updated_at,
          last_message: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            sender_name: profileMap.get(lastMessage.sender_id) || null,
            created_at: lastMessage.created_at,
          } : undefined,
          unread_count: 0,
        };
      });

      return groupChatsWithMessages;
    },
    enabled: !!user?.id,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  // Fetch messages for a specific group chat
  const useGroupMessages = (groupChatId: string | undefined) => {
    return useQuery({
      queryKey: ['group-messages', groupChatId],
      queryFn: async () => {
        if (!groupChatId) return [];

        const { data: messages, error } = await supabase
          .from('group_chat_messages')
          .select('*')
          .eq('group_chat_id', groupChatId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Get sender profiles
        const senderIds = [...new Set(messages.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .in('user_id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        return messages.map(msg => ({
          ...msg,
          sender: profileMap.get(msg.sender_id) || null,
        })) as GroupMessage[];
      },
      enabled: !!groupChatId,
    });
  };

  // Send group message
  const sendGroupMessage = useMutation({
    mutationFn: async ({ groupChatId, content }: { groupChatId: string; content: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_chat_messages')
        .insert({
          group_chat_id: groupChatId,
          sender_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Update group chat updated_at
      await supabase
        .from('project_group_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupChatId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group-chats', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['group-messages', variables.groupChatId] });
    },
  });

  // Real-time subscription for group messages
  useEffect(() => {
    if (!user?.id || groupChats.length === 0) return;

    const groupChatIds = groupChats.map(gc => gc.id);

    const channel = supabase
      .channel('group-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
        },
        (payload) => {
          if (groupChatIds.includes(payload.new.group_chat_id)) {
            queryClient.invalidateQueries({ queryKey: ['group-chats', user.id] });
            queryClient.invalidateQueries({ queryKey: ['group-messages', payload.new.group_chat_id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, groupChats, queryClient]);

  return {
    groupChats,
    loadingGroupChats,
    useGroupMessages,
    sendGroupMessage,
  };
}
