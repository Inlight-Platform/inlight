import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useMyGroups } from '@/hooks/useGroups';
import { MAX_COMMENT_LENGTH, usePostComments } from '@/hooks/usePostComments';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn, capitalizeName } from '@/lib/utils';

interface PostCommentsProps {
  postId: string;
  postOwnerId?: string;
  className?: string;
}

/**
 * Comment thread for a feed post, rendered inside the expanded item sheet.
 * Clicks stop propagating so controls never trigger card navigation.
 */
export const PostComments: React.FC<PostCommentsProps> = ({ postId, postOwnerId, className }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const commentsQuery = usePostComments(postId);
  const comments = commentsQuery.data ?? [];

  const { data: myGroups } = useMyGroups();
  const facultyGroupIds = new Set(
    (myGroups ?? []).filter((g) => g.is_faculty).map((g) => g.id),
  );

  const postGroupsQuery = useQuery({
    queryKey: ['post-groups', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_groups')
        .select('group_id')
        .eq('post_id', postId);
      if (error) throw error;
      return (data ?? []) as { group_id: string }[];
    },
    enabled: !!postId,
  });
  const postGroupIds = (postGroupsQuery.data ?? []).map((r) => r.group_id);
  const isGroupFacultyForPost = postGroupIds.some((gid) => facultyGroupIds.has(gid));

  const invalidateCommentCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
    queryClient.invalidateQueries({ queryKey: ['post-comment-count', postId] });
  };

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.id) throw new Error('You must be logged in to comment.');
      const trimmed = content.trim();
      if (!trimmed) throw new Error('Comment cannot be empty.');
      if (trimmed.length > MAX_COMMENT_LENGTH) {
        throw new Error(`Comments are limited to ${MAX_COMMENT_LENGTH} characters.`);
      }
      const { error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, content: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft('');
      invalidateCommentCaches();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add comment. Please try again.');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCommentCaches();
      toast.success('Comment deleted');
    },
    onError: () => {
      toast.error('Failed to delete comment. Please try again.');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error('Comment cannot be empty.');
      return;
    }
    addCommentMutation.mutate(trimmed);
  };

  const canModerateComment = (commentUserId: string) =>
    user?.id === commentUserId ||
    user?.id === postOwnerId ||
    isAdmin ||
    isGroupFacultyForPost;

  return (
    <section
      className={cn('rounded-xl border border-border bg-card p-4', className)}
      onClick={(event) => event.stopPropagation()}
      aria-label="Comments"
    >
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Comments{commentsQuery.isSuccess ? ` (${comments.length})` : ''}
        </h3>
      </div>

      {commentsQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : commentsQuery.isError ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-muted-foreground">Unable to load comments.</p>
          <Button variant="outline" size="sm" onClick={() => commentsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No comments yet. Be the first to reply!</p>
      ) : (
        <ul className="mb-4 space-y-3">
          {comments.map((comment) => {
            const name = capitalizeName(comment.author?.display_name || '') || 'Inlight Member';
            return (
              <li key={comment.id} className="group flex items-start gap-2.5">
                <Avatar
                  className="h-7 w-7 shrink-0 cursor-pointer"
                  onClick={() => navigate(`/profile/${comment.user_id}`)}
                >
                  <AvatarImage src={comment.author?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {name[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="cursor-pointer truncate text-xs font-semibold text-foreground hover:underline"
                      onClick={() => navigate(`/profile/${comment.user_id}`)}
                    >
                      {name}
                    </button>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {canModerateComment(comment.user_id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete comment"
                        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteCommentMutation.isPending}
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                      >
                        {deleteCommentMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {comment.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a comment..."
            rows={2}
            maxLength={MAX_COMMENT_LENGTH}
            aria-label="Write a comment"
            className="min-h-[44px] resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {draft.trim().length > MAX_COMMENT_LENGTH - 100
                ? `${draft.trim().length}/${MAX_COMMENT_LENGTH}`
                : ''}
            </span>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5"
              disabled={!draft.trim() || addCommentMutation.isPending}
            >
              {addCommentMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Comment
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border pt-3 text-center">
          <p className="mb-2 text-xs text-muted-foreground">Log in to join the conversation.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
            Log In
          </Button>
        </div>
      )}
    </section>
  );
};

export default PostComments;
