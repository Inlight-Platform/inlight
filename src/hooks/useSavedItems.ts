import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SavedItemType = 'resource' | 'job' | 'open_role';

interface SavedItem {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string | null;
  item_title: string;
  item_url: string | null;
  item_metadata: Record<string, any>;
  saved_at: string;
}

interface SaveItemInput {
  item_type: SavedItemType;
  item_id?: string;
  item_title: string;
  item_url?: string;
  item_metadata?: Record<string, any>;
}

export const useSavedItems = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedItems = [], isLoading } = useQuery({
    queryKey: ['saved-items', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });
      if (error) throw error;
      return data as SavedItem[];
    },
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveItemInput) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_items')
        .insert({
          user_id: user.id,
          item_type: input.item_type,
          item_id: input.item_id || null,
          item_title: input.item_title,
          item_url: input.item_url || null,
          item_metadata: input.item_metadata || {},
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
      toast.success('Saved!');
    },
    onError: () => toast.error('Could not save item'),
  });

  const unsaveMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
      toast.success('Removed from saves');
    },
    onError: () => toast.error('Could not remove item'),
  });

  const isSaved = (itemType: SavedItemType, itemTitle: string, itemUrl?: string) => {
    return savedItems.some(
      (s) => s.item_type === itemType && s.item_title === itemTitle && (s.item_url || '') === (itemUrl || '')
    );
  };

  const getSavedItem = (itemType: SavedItemType, itemTitle: string, itemUrl?: string) => {
    return savedItems.find(
      (s) => s.item_type === itemType && s.item_title === itemTitle && (s.item_url || '') === (itemUrl || '')
    );
  };

  const saveItem = (input: SaveItemInput) => {
    if (!user) {
      toast.error('Sign in to save items');
      return;
    }
    saveMutation.mutate(input);
  };

  const unsaveItem = (itemId: string) => {
    unsaveMutation.mutate(itemId);
  };

  const toggleSave = (input: SaveItemInput) => {
    const existing = getSavedItem(input.item_type, input.item_title, input.item_url);
    if (existing) {
      unsaveItem(existing.id);
    } else {
      saveItem(input);
    }
  };

  return {
    savedItems,
    isLoading,
    isSaved,
    getSavedItem,
    saveItem,
    unsaveItem,
    toggleSave,
  };
};

export type { SavedItem, SaveItemInput };
