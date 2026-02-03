import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Users, Clock, Check, ExternalLink, Film, Music, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const CreativeConnection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firstDegree } = useNetworkConnections();
  const { sendRequest, hasSentRequestTo } = useConnectionRequests();

  // Fetch all profiles (excluding current user and existing connections)
  const { data: randomProfile, isLoading } = useQuery({
    queryKey: ['creative-connection', user?.id, firstDegree.join(',')],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get IDs to exclude (self + existing connections)
      const excludeIds = [user.id, ...firstDegree];

      // Fetch profiles not in exclude list
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .not('user_id', 'in', `(${excludeIds.join(',')})`)
        .not('display_name', 'is', null);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Pick a random profile
      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex];
    },
    enabled: !!user?.id,
    staleTime: 0, // Always refetch on mount
    refetchOnWindowFocus: false,
  });

  // Generate a personalized intro based on their profile
  const personalizedIntro = useMemo(() => {
    if (!randomProfile) return '';

    const parts: string[] = [];

    // Check for skills
    if (randomProfile.skills && randomProfile.skills.length > 0) {
      const skillsText = randomProfile.skills.slice(0, 3).join(', ');
      parts.push(`skilled in ${skillsText}`);
    }

    // Check for role
    if (randomProfile.role) {
      parts.push(`a ${randomProfile.role}`);
    }

    // Check for why_artist
    if (randomProfile.why_artist) {
      const truncated = randomProfile.why_artist.length > 100 
        ? randomProfile.why_artist.slice(0, 100) + '...' 
        : randomProfile.why_artist;
      parts.push(`who creates because "${truncated}"`);
    }

    // Check for favorite movie
    if (randomProfile.favorite_movie) {
      parts.push(`loves "${randomProfile.favorite_movie}"`);
    }

    // Check for favorite artist
    if (randomProfile.favorite_artist) {
      parts.push(`inspired by ${randomProfile.favorite_artist}`);
    }

    // Check for badges (affiliations)
    if (randomProfile.badges && randomProfile.badges.length > 0) {
      parts.push(`affiliated with ${randomProfile.badges[0]}`);
    }

    // Build the intro
    if (parts.length === 0) {
      return 'A fellow creative ready to connect!';
    }

    // Combine 2-3 parts for a natural sentence
    const selectedParts = parts.slice(0, 3);
    if (selectedParts.length === 1) {
      return `Meet someone ${selectedParts[0]}.`;
    }
    
    return `Meet someone ${selectedParts.slice(0, -1).join(', ')} and ${selectedParts[selectedParts.length - 1]}.`;
  }, [randomProfile]);

  if (!user) return null;
  if (isLoading) {
    return (
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!randomProfile) return null;

  const displayName = randomProfile.display_name || 'Creative';
  const isPending = hasSentRequestTo(randomProfile.user_id!);
  const isConnected = firstDegree.includes(randomProfile.user_id!);

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (randomProfile.user_id) {
      sendRequest.mutate(randomProfile.user_id);
    }
  };

  const handleNavigateToProfile = () => {
    if (randomProfile.user_id) {
      navigate(`/profile/${randomProfile.user_id}`);
    }
  };

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header accent */}
      <div 
        className="h-2"
        style={{
          background: 'linear-gradient(90deg, hsl(330 100% 64%), hsl(264 100% 65%), hsl(200 100% 60%))',
        }}
      />
      
      <CardContent className="p-5">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Creative Connection</h3>
        </div>

        {/* Profile Content */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar 
            className="w-16 h-16 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
            onClick={handleNavigateToProfile}
          >
            <AvatarImage src={randomProfile.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-accent/20">
              {displayName[0]?.toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <button
              onClick={handleNavigateToProfile}
              className="font-display font-semibold text-lg hover:text-primary transition-colors text-left"
            >
              {displayName}
            </button>
            
            {randomProfile.role && (
              <p className="text-sm text-muted-foreground truncate">
                {randomProfile.role}
              </p>
            )}

            {/* Personalized intro */}
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {personalizedIntro}
            </p>

            {/* Quick facts */}
            <div className="flex flex-wrap gap-2 mt-3">
              {randomProfile.favorite_movie && (
                <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                  <Film className="w-3 h-3" />
                  {randomProfile.favorite_movie}
                </span>
              )}
              {randomProfile.favorite_artist && (
                <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                  <Palette className="w-3 h-3" />
                  {randomProfile.favorite_artist}
                </span>
              )}
              {randomProfile.favorite_song && (
                <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                  <Music className="w-3 h-3" />
                  {randomProfile.favorite_song}
                </span>
              )}
            </div>

            {/* Skills */}
            {randomProfile.skills && randomProfile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {randomProfile.skills.slice(0, 4).map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20"
                  >
                    {skill}
                  </span>
                ))}
                {randomProfile.skills.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{randomProfile.skills.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          {isConnected ? (
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-full bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
              onClick={handleNavigateToProfile}
            >
              <Check className="w-4 h-4 mr-2" />
              Connected
            </Button>
          ) : isPending ? (
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-full text-amber-600 dark:text-amber-400 border-amber-500/30"
              disabled
            >
              <Clock className="w-4 h-4 mr-2" />
              Pending
            </Button>
          ) : (
            <Button
              className="flex-1 h-10 rounded-full bg-gradient-to-r from-[hsl(264,100%,65%)] to-[hsl(280,100%,60%)] text-white hover:opacity-90"
              onClick={handleConnect}
              disabled={sendRequest.isPending}
            >
              <Users className="w-4 h-4 mr-2" />
              Connect
            </Button>
          )}
          
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={handleNavigateToProfile}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreativeConnection;
