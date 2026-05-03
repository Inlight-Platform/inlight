import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, ChevronRight, ChevronLeft, Clock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestedUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
}

export const ConnectionSuggestions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { following, isMutual } = useNetworkConnections();
  const { sendRequest, hasSentRequestTo } = useConnectionRequests();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch suggested users (2nd degree connections or random users not followed)
  const { data: suggestions = [] } = useQuery({
    queryKey: ['connection-suggestions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // First try to get 2nd degree connections
      const { data: secondDegree } = await supabase
        .rpc('get_2nd_degree_connections', { target_user_id: user.id });

      const secondDegreeIds = (secondDegree || []).map((d: { user_id: string }) => d.user_id);

      // Get profiles for 2nd degree, excluding already followed
      if (secondDegreeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url, headline')
          .in('user_id', secondDegreeIds.slice(0, 10));
        
        if (profiles && profiles.length > 0) {
          return profiles.filter(p => !following.includes(p.user_id)).slice(0, 3) as SuggestedUser[];
        }
      }

      // Fallback: get random users not followed
      const { data: randomProfiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, headline')
        .neq('user_id', user.id)
        .limit(20);

      if (!randomProfiles) return [];

      // Filter out already followed and shuffle
      const notFollowed = randomProfiles.filter(p => !following.includes(p.user_id));
      const shuffled = notFollowed.sort(() => Math.random() - 0.5);
      
      return shuffled.slice(0, 3) as SuggestedUser[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (!user || suggestions.length === 0) {
    return null;
  }

  // Collapsed state - show expand button
  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(false)}
        className="h-10 w-10 rounded-full bg-card border border-border shadow-sm"
        title="Expand suggestions"
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Card className={cn("bg-card border-border transition-all duration-200")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Grow Your Community
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-6 w-6 -mr-2"
            title="Collapse"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((person) => (
          <div 
            key={person.user_id} 
            className="flex items-center gap-2"
          >
            <Avatar 
              className="h-8 w-8 cursor-pointer"
              onClick={() => navigate(`/profile/${person.user_id}`)}
            >
              <AvatarImage src={person.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {person.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p 
                className="text-sm font-medium truncate cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${person.user_id}`)}
              >
                {person.display_name || 'Unknown'}
              </p>
              {person.headline && (
                <p className="text-xs text-muted-foreground truncate">
                  {person.headline}
                </p>
              )}
            </div>
            {isMutual(person.user_id) ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-green-500"
                disabled
              >
                <Check className="w-4 h-4" />
              </Button>
            ) : hasSentRequestTo(person.user_id) ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-amber-500"
                disabled
              >
                <Clock className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => sendRequest.mutate(person.user_id)}
                disabled={sendRequest.isPending}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/people')}
        >
          Find more people
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};
