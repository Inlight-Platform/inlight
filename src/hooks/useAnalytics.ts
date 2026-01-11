import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTrackProfileView = (viewerId: string, profileId: string) => {
  useEffect(() => {
    if (!viewerId || !profileId || viewerId === profileId) return;

    const trackView = async () => {
      try {
        await supabase
          .from('profile_views')
          .insert({
            viewer_id: viewerId,
            viewed_profile_id: profileId,
          });
      } catch (error) {
        console.error('Error tracking profile view:', error);
      }
    };

    trackView();
  }, [viewerId, profileId]);
};

export const useUpdateEngagement = () => {
  const updateEngagement = async (
    userId: string, 
    field: 'profile_views' | 'messages_sent' | 'messages_received' | 'connections_made' | 'story_views'
  ) => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Try to upsert the engagement record
      const { data: existing } = await supabase
        .from('user_engagement')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        // Update existing record
        await supabase
          .from('user_engagement')
          .update({ [field]: (existing[field] || 0) + 1 })
          .eq('id', existing.id);
      } else {
        // Insert new record
        await supabase
          .from('user_engagement')
          .insert({
            user_id: userId,
            date: today,
            [field]: 1,
          });
      }
    } catch (error) {
      console.error('Error updating engagement:', error);
    }
  };

  return { updateEngagement };
};
