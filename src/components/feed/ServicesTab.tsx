import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SERVICE_CATEGORIES, matchesService, ServiceCategory } from '@/data/services';

interface ServiceProfile {
  user_id: string;
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  badges: string[] | null;
  skills: string[] | null;
}

export const ServicesTab: React.FC = () => {
  const navigate = useNavigate();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['services-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, stage_name, avatar_url, headline, location, badges, skills')
        .limit(2000);
      if (error) throw error;
      return (data || []) as ServiceProfile[];
    },
  });

  const byCategory = useMemo(() => {
    const map = new Map<string, ServiceProfile[]>();
    for (const cat of SERVICE_CATEGORIES) {
      const matches = profiles.filter((p) =>
        matchesService(cat, [...(p.badges || []), ...(p.skills || []), p.headline]),
      );
      map.set(cat.slug, matches);
    }
    return map;
  }, [profiles]);

  const activeCategory = activeSlug
    ? SERVICE_CATEGORIES.find((c) => c.slug === activeSlug) || null
    : null;

  if (activeCategory) {
    const list = byCategory.get(activeCategory.slug) || [];
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setActiveSlug(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> All Services
          </Button>
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <span>{activeCategory.emoji}</span> {activeCategory.label}
            </h2>
            <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No one is offering {activeCategory.label.toLowerCase()} services yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <Card
                key={p.user_id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/profile/${p.user_id}`)}
              >
                <CardContent className="p-4 flex gap-3 items-start">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>
                      {(p.stage_name || p.display_name || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {p.stage_name || p.display_name || 'User'}
                    </p>
                    {p.headline && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.headline}</p>
                    )}
                    {p.location && (
                      <p className="text-xs text-muted-foreground mt-1">📍 {p.location}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-display font-bold">Services</h2>
        <p className="text-sm text-muted-foreground">
          Browse creatives available for hire by service category.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICE_CATEGORIES.map((cat) => {
            const count = byCategory.get(cat.slug)?.length || 0;
            return (
              <Card
                key={cat.slug}
                className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                onClick={() => setActiveSlug(cat.slug)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-3xl">{cat.emoji}</div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <h3 className="font-display font-semibold text-lg">{cat.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServicesTab;
