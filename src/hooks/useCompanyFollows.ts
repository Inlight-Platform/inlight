import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Company {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  location: string | null;
  owner_user_id: string | null;
  created_at: string;
}

export const useCompanyFollows = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Company[];
    },
  });

  const { data: followedCompanyIds = [] } = useQuery({
    queryKey: ['company-follows', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('company_follows')
        .select('company_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(d => d.company_id);
    },
    enabled: !!user?.id,
  });

  const followCompany = useMutation({
    mutationFn: async (companyId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('company_follows')
        .insert({ user_id: user.id, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-follows'] });
    },
  });

  const unfollowCompany = useMutation({
    mutationFn: async (companyId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('company_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('company_id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-follows'] });
    },
  });

  const isFollowingCompany = (companyId: string) => followedCompanyIds.includes(companyId);

  return {
    companies,
    companiesLoading,
    followedCompanyIds,
    isFollowingCompany,
    followCompany,
    unfollowCompany,
  };
};
