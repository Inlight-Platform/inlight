import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { toast } from 'sonner';

export interface DBOpportunity {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  posted_by: string;
  company: string | null;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  experience_level: string;
  roles: string[];
  skills: string[];
  requirements: string[];
  deadline: string | null;
  start_date: string | null;
  duration: string | null;
  tags: string[];
  is_featured: boolean;
  action_type: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
  updated_at: string;
}

interface DBJobPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
}

// Adapter to match existing component expectations
export interface OpportunityView {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  postedBy: string;
  company?: string;
  location: string;
  isRemote: boolean;
  compensation?: string;
  experienceLevel: string;
  roles: string[];
  skills: string[];
  requirements: string[];
  deadline?: string;
  startDate?: string;
  duration?: string;
  tags: string[];
  createdAt: string;
  isFeatured: boolean;
  actionType: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  source?: 'opportunity' | 'post';
  applicants: { userId: string; appliedAt: string; status: string }[];
}

function toView(row: DBOpportunity): OpportunityView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    postedBy: row.posted_by,
    company: row.company || undefined,
    location: row.location || 'Remote',
    isRemote: row.is_remote,
    compensation: row.compensation || undefined,
    experienceLevel: row.experience_level,
    roles: row.roles || [],
    skills: row.skills || [],
    requirements: row.requirements || [],
    deadline: row.deadline || undefined,
    startDate: row.start_date || undefined,
    duration: row.duration || undefined,
    tags: row.tags || [],
    createdAt: row.created_at,
    isFeatured: row.is_featured,
    actionType: row.action_type || 'apply',
    imageUrl: row.image_url || undefined,
    linkUrl: row.link_url || undefined,
    linkTitle: row.link_title || undefined,
    source: 'opportunity',
    applicants: [],
  };
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s)]+/)?.[0]?.trim();
}

function postToView(row: DBJobPost): OpportunityView {
  const titleMatch = row.content.match(/^🎯\s+\*\*(.+?)\*\*/);
  const title = titleMatch?.[1]?.trim() || 'Job Opportunity';
  const descriptionWithTitle = row.content.replace(/^🎯\s+\*\*.+?\*\*\s*/s, '').trim();
  const locationMatch = descriptionWithTitle.match(/\n\n📍\s*(.+)\s*$/);
  const description = locationMatch
    ? descriptionWithTitle.replace(/\n\n📍\s*.+\s*$/s, '').trim()
    : descriptionWithTitle;

  return {
    id: row.id,
    title,
    description: description || row.content,
    type: 'job',
    status: 'open',
    postedBy: row.user_id,
    location: locationMatch?.[1]?.trim() || 'Remote',
    isRemote: !locationMatch,
    experienceLevel: 'any',
    roles: [],
    skills: [],
    requirements: [],
    tags: ['feed'],
    createdAt: row.created_at,
    isFeatured: false,
    actionType: 'external',
    imageUrl: row.image_url || undefined,
    linkUrl: row.link_url || extractFirstUrl(row.content) || undefined,
    linkTitle: row.link_title || 'Apply Externally',
    source: 'post',
    applicants: [],
  };
}

function normalizeOpportunityTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isUsableExternalUrl(value?: string | null) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !host.includes('inlight') &&
      host !== 'localhost' &&
      host !== '127.0.0.1'
    );
  } catch {
    return false;
  }
}

export function useOpportunities() {
  const { user } = useAuth();
  const { canManageJobs } = useFeatureAccess();
  const queryClient = useQueryClient();

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const { data: opportunityRows, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (opportunitiesError) throw opportunitiesError;

      const { data: jobPostRows, error: jobPostsError } = await supabase
        .from('posts')
        .select('id, user_id, content, image_url, link_url, link_title, created_at')
        .like('content', '🎯%')
        .order('created_at', { ascending: false });

      if (jobPostsError) throw jobPostsError;

      const canonicalOpportunities = (opportunityRows as DBOpportunity[]).map(toView);
      const canonicalTitles = new Set(canonicalOpportunities.map((row) => normalizeOpportunityTitle(row.title)));
      const feedOnlyJobs = ((jobPostRows || []) as DBJobPost[])
        .map(postToView)
        .filter((row) => !canonicalTitles.has(normalizeOpportunityTitle(row.title)))
        .filter((row) => isUsableExternalUrl(row.linkUrl));

      return [
        ...canonicalOpportunities,
        ...feedOnlyJobs,
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const createOpportunity = useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      type: string;
      status: string;
      company?: string;
      location?: string;
      is_remote: boolean;
      compensation?: string;
      experience_level: string;
      roles: string[];
      skills: string[];
      requirements: string[];
      deadline?: string;
      start_date?: string;
      duration?: string;
      tags: string[];
      is_featured: boolean;
      action_type: string;
      image_url?: string;
      link_url?: string;
      link_title?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (!canManageJobs) {
        throw new Error('This beta group cannot create jobs.');
      }

      const { error } = await supabase.from('opportunities').insert({
        title: input.title,
        description: input.description,
        type: input.type,
        status: input.status,
        posted_by: user.id,
        company: input.company || null,
        location: input.location || 'Remote',
        is_remote: input.is_remote,
        compensation: input.compensation || null,
        experience_level: input.experience_level,
        roles: input.roles,
        requirements: input.requirements,
        deadline: input.deadline || null,
        start_date: input.start_date || null,
        duration: input.duration || null,
        tags: input.tags,
        is_featured: input.is_featured,
        action_type: input.action_type,
        image_url: input.image_url || null,
        link_url: input.link_url || null,
        link_title: input.link_title || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('Opportunity posted successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to post opportunity:', error);
      toast.error(error.message || 'Failed to post opportunity. Please try again.');
    },
  });

  const updateOpportunity = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description: string;
      type: string;
      status: string;
      company?: string;
      location?: string;
      is_remote: boolean;
      compensation?: string;
      experience_level: string;
      roles: string[];
      skills: string[];
      deadline?: string;
      start_date?: string;
      duration?: string;
      action_type: string;
      image_url?: string | null;
      link_url?: string | null;
      link_title?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (!canManageJobs) {
        throw new Error('This beta group cannot edit jobs.');
      }

      const { error } = await supabase
        .from('opportunities')
        .update({
          title: input.title,
          description: input.description,
          type: input.type,
          status: input.status,
          company: input.company || null,
          location: input.location || 'Remote',
          is_remote: input.is_remote,
          compensation: input.compensation || null,
          experience_level: input.experience_level,
          roles: input.roles,
          deadline: input.deadline || null,
          start_date: input.start_date || null,
          duration: input.duration || null,
          action_type: input.action_type,
          image_url: input.image_url ?? null,
          link_url: input.link_url ?? null,
          link_title: input.link_title ?? null,
        })
        .eq('id', input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('Opportunity updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update opportunity. Please try again.');
    },
  });

  const deleteOpportunity = useMutation({
    mutationFn: async (input: string | { id: string; source?: OpportunityView['source'] }) => {
      if (!user) throw new Error('Not authenticated');
      if (!canManageJobs) {
        throw new Error('This beta group cannot delete jobs.');
      }

      const id = typeof input === 'string' ? input : input.id;
      const source = typeof input === 'string' ? 'opportunity' : input.source || 'opportunity';

      const query = source === 'post'
        ? supabase.from('posts').delete().eq('id', id).select('id')
        : supabase.from('opportunities').delete().eq('id', id).select('id');

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) throw new Error('No matching job was deleted.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('Opportunity deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete opportunity');
    },
  });

  return { opportunities, isLoading, createOpportunity, updateOpportunity, deleteOpportunity };
}
