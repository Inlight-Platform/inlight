import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

export const ReferralCountCard: React.FC<{ userId: string | undefined }> = ({ userId }) => {
  const { data: count = 0 } = useQuery({
    queryKey: ['referral-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count: c } = await supabase
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('referred_by', userId);
      return c || 0;
    },
    enabled: !!userId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Referrals
        </CardTitle>
        <CardDescription>People who joined Inlight through your invitations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-display font-bold">{count}</span>
          <span className="text-sm text-muted-foreground">
            {count === 1 ? 'person referred' : 'people referred'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Thanks for growing the community — rewards for beta referrers are coming soon.
        </p>
      </CardContent>
    </Card>
  );
};