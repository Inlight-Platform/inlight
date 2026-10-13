import { supabase } from '@/integrations/supabase/client';

export async function fetchGroupProjects(groupId: string) {
  const { data: links, error: linksError } = await supabase
    .from('project_groups')
    .select('project_id')
    .eq('group_id', groupId);
  if (linksError) throw linksError;

  const projectIds = [...new Set((links || []).map((link) => link.project_id))];
  if (!projectIds.length) return [];

  // The browse projection preserves project access checks without requesting
  // restricted workflow columns through a projects(*) embed.
  const { data, error } = await supabase
    .from('projects_browse')
    .select('id, creator_id, title, description, header_image_url, main_image_url, created_at, category, status, link_url, link_title, visibility, author_identity, author_group_id')
    .in('id', projectIds);
  if (error) throw error;
  return data || [];
}
