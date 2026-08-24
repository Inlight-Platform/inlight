import { supabase } from '@/integrations/supabase/client';

interface EnsureAcceptedProjectCreditArgs {
  userId: string;
  projectTitle: string;
  roleName: string;
}

const currentYear = new Date().getFullYear();

export const ensureAcceptedProjectCredit = async ({
  userId,
  projectTitle,
  roleName,
}: EnsureAcceptedProjectCreditArgs) => {
  const normalizedProjectTitle = projectTitle.trim();
  const normalizedRoleName = roleName.trim();

  if (!userId || !normalizedProjectTitle || !normalizedRoleName) {
    return;
  }

  const { data: existingCredit, error: lookupError } = await supabase
    .from('credits')
    .select('id')
    .eq('user_id', userId)
    .ilike('project', normalizedProjectTitle)
    .ilike('role', normalizedRoleName)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingCredit?.id) {
    const { error } = await supabase
      .from('credits')
      .update({ verified: true })
      .eq('id', existingCredit.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('credits').insert({
    user_id: userId,
    project: normalizedProjectTitle,
    role: normalizedRoleName,
    year: currentYear,
    verified: true,
  });

  if (error) throw error;
};
