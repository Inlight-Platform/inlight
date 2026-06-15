import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/integrations/supabase/config';
import type { Database } from '@/integrations/supabase/types';

type EngagementField = 'profile_views' | 'messages_sent' | 'messages_received' | 'connections_made' | 'story_views';
type UserEngagementInsert = Database['public']['Tables']['user_engagement']['Insert'];
type UserEngagementUpdate = Database['public']['Tables']['user_engagement']['Update'];

export const useTrackProfileView = (profileId: string) => {
  useEffect(() => {
    if (!profileId) return;

    const trackView = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Only track if user is authenticated
        if (!session?.access_token) {
          return;
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/track-profile-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ profileId }),
        });

        if (!response.ok && response.status !== 200 && response.status !== 204) {
          console.error('Failed to track profile view:', response.status);
        }
      } catch (error) {
        console.error('Error tracking profile view:', error);
      }
    };

    trackView();
  }, [profileId]);
};

export const useUpdateEngagement = () => {
  const updateEngagement = async (field: EngagementField) => {
    try {
      // Get authenticated user session - do NOT trust client-provided user_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('Cannot update engagement: user not authenticated');
        return;
      }

      const userId = session.user.id;
      const today = new Date().toISOString().split('T')[0];
      
      // Try to upsert the engagement record
      const { data: existing } = await supabase
        .from('user_engagement')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const updatePayload: UserEngagementUpdate = { [field]: (existing[field] || 0) + 1 };
        await supabase
          .from('user_engagement')
          .update(updatePayload)
          .eq('id', existing.id);
      } else {
        // Insert new record
        const insertPayload: UserEngagementInsert = {
          user_id: userId,
          date: today,
          [field]: 1,
        };
        await supabase
          .from('user_engagement')
          .insert(insertPayload);
      }
    } catch (error) {
      console.error('Error updating engagement:', error);
    }
  };

  return { updateEngagement };
};
