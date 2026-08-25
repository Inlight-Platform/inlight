import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const MAX_COMMENT_LENGTH = 1000;

export interface PostCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface CommentAuthor {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PostCommentWithAuthor extends PostCommentRow {
  author?: CommentAuthor;
}

/** Comment count for a post; RLS only counts rows the viewer is allowed to see. */
export const usePostCommentCount = (postId?: string | null) =>
  useQuery({
    queryKey: ['post-comment-count', postId],
    queryFn: async () => {
      if (!postId) return 0;
      const { count, error } = await supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!postId,
  });

/** Flat comment thread for a post, oldest-to-newest, with author profiles. */
export const usePostComments = (postId: string | null) =>
  useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async (): Promise<PostCommentWithAuthor[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = ((data || []) as PostCommentRow[]).filter((row) => Boolean(row?.id));
      const authorIds = [...new Set(rows.map((row) => row.user_id))];
      const authors = new Map<string, CommentAuthor>();
      if (authorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .in('user_id', authorIds);
        if (profilesError) throw profilesError;
        (profiles || []).forEach((profile) => authors.set(profile.user_id, profile));
      }

      return rows.map((row) => ({ ...row, author: authors.get(row.user_id) }));
    },
    enabled: !!postId,
  });
