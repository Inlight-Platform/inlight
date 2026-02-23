import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  requirements: string[];
  deadline: string | null;
  start_date: string | null;
  duration: string | null;
  tags: string[];
  is_featured: boolean;
  action_type: string;
  created_at: string;
  updated_at: string;
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
  requirements: string[];
  deadline?: string;
  startDate?: string;
  duration?: string;
  tags: string[];
  createdAt: string;
  isFeatured: boolean;
  actionType: string;
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
    requirements: row.requirements || [],
    deadline: row.deadline || undefined,
    startDate: row.start_date || undefined,
    duration: row.duration || undefined,
    tags: row.tags || [],
    createdAt: row.created_at,
    isFeatured: row.is_featured,
    actionType: row.action_type || 'apply',
    applicants: [], // Will be enriched separately if needed
  };
}

export function useOpportunities() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as DBOpportunity[]).map(toView);
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
      requirements: string[];
      deadline?: string;
      start_date?: string;
      duration?: string;
      tags: string[];
      is_featured: boolean;
      action_type: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

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
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('Opportunity posted successfully!');
    },
    onError: () => {
      toast.error('Failed to post opportunity. Please try again.');
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
      deadline?: string;
      start_date?: string;
      duration?: string;
      action_type: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

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
        })
        .eq('id', input.id)
        .eq('posted_by', user.id);

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

  return { opportunities, isLoading, createOpportunity, updateOpportunity };
}
