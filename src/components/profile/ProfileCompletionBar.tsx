import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle } from 'lucide-react';

interface ProfileCompletionBarProps {
  userId: string;
  profile: {
    role: string | null;
    graduation_year: number | null;
    location: string | null;
    instagram_url: string | null;
    website_url: string | null;
    badges: string[] | null;
    skills: string[] | null;
    bio: string | null;
  };
  creditsCount: number;
}

interface CompletionItem {
  label: string;
  complete: boolean;
}

const ProfileCompletionBar: React.FC<ProfileCompletionBarProps> = ({ userId, profile, creditsCount }) => {
  // Fetch materials count
  const { data: materialsCount = 0 } = useQuery({
    queryKey: ['user-media-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_media')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) return 0;
      return count || 0;
    },
  });

  // Fetch projects count
  const { data: projectsCount = 0 } = useQuery({
    queryKey: ['user-projects-count', userId],
    queryFn: async () => {
      const { count: creatorCount } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', userId);
      const { count: memberCount } = await supabase
        .from('project_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (creatorCount || 0) + (memberCount || 0);
    },
  });

  // Fetch posts count
  const { data: postsCount = 0 } = useQuery({
    queryKey: ['user-posts-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) return 0;
      return count || 0;
    },
  });

  const items: CompletionItem[] = [
    { label: 'Role', complete: !!profile.role },
    { label: 'Grad Year', complete: !!profile.graduation_year },
    { label: 'Location', complete: !!profile.location },
    { label: 'External Links', complete: !!(profile.instagram_url || profile.website_url) },
    { label: 'Affiliation', complete: !!(profile.badges && profile.badges.length > 0) },
    { label: 'Skills', complete: !!(profile.skills && profile.skills.length > 0) },
    { label: 'Bio', complete: !!profile.bio },
    { label: 'Materials', complete: materialsCount > 0 },
    { label: 'Credits', complete: creditsCount > 0 },
    { label: 'Projects', complete: projectsCount > 0 },
    { label: 'Posts', complete: postsCount > 0 },
  ];

  const completed = items.filter(i => i.complete).length;
  const percentage = Math.round((completed / items.length) * 100);

  if (percentage === 100) return null;

  return (
    <div className="mt-4 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">Profile Completion</h3>
        <span className="text-sm font-medium text-primary">{percentage}%</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Completed profiles get viewed 7x more</p>
      <Progress value={percentage} className="h-2 mb-3" />
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              item.complete 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {item.complete ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileCompletionBar;
