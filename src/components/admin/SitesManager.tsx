import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const SitesManager: React.FC = () => {
  const { data: programs, isLoading } = useQuery({
    queryKey: ['admin-showcase-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('showcase_programs')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ['admin-showcase-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('showcase_profiles')
        .select('program_slug')
        .eq('is_active', true);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.program_slug] = (map[r.program_slug] || 0) + 1;
      });
      return map;
    },
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Showcase Sites</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading sites...</p>
        ) : !programs || programs.length === 0 ? (
          <p className="text-muted-foreground">No showcase sites yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {programs.map((p) => {
              const showcaseUrl = `${baseUrl}/showcase/${p.slug}`;
              const joinUrl = `${baseUrl}/showcase/${p.slug}/join`;
              const memberCount = counts?.[p.slug] ?? 0;
              return (
                <Card key={p.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">/{p.slug}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        <Users className="w-3 h-3" />
                        {memberCount}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    )}

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium mb-1">Public Showcase</p>
                        <div className="flex gap-1">
                          <Button asChild size="sm" variant="outline" className="flex-1 justify-start text-xs h-8">
                            <Link to={`/showcase/${p.slug}`}>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => copyLink(showcaseUrl)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium mb-1">Join Link</p>
                        <div className="flex gap-1">
                          <Button asChild size="sm" variant="outline" className="flex-1 justify-start text-xs h-8">
                            <Link to={`/showcase/${p.slug}/join`}>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => copyLink(joinUrl)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SitesManager;
