import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, MessageCircle, Image, Send, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Studio {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface StudioPost {
  id: string;
  studio_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface StudioComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const SchoolStudios: React.FC = () => {
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [showCreatePost, setShowCreatePost] = useState(false);
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch studios
  const { data: studios, isLoading: studiosLoading } = useQuery({
    queryKey: ['studios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Studio[];
    },
  });

  // Fetch posts for selected studio
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['studio-posts', selectedStudio?.id],
    queryFn: async () => {
      if (!selectedStudio) return [];
      const { data, error } = await supabase
        .from('studio_posts')
        .select('*')
        .eq('studio_id', selectedStudio.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch user profiles for posts
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      return data.map(post => ({
        ...post,
        user_profile: profileMap.get(post.user_id),
      })) as StudioPost[];
    },
    enabled: !!selectedStudio,
  });

  // Fetch comments for all posts
  const { data: comments } = useQuery({
    queryKey: ['studio-comments', posts?.map(p => p.id)],
    queryFn: async () => {
      if (!posts || posts.length === 0) return [];
      const postIds = posts.map(p => p.id);
      const { data, error } = await supabase
        .from('studio_comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch user profiles for comments
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      return data.map(comment => ({
        ...comment,
        user_profile: profileMap.get(comment.user_id),
      })) as StudioComment[];
    },
    enabled: !!posts && posts.length > 0,
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!currentUser || !selectedStudio) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('studio_posts')
        .insert({
          studio_id: selectedStudio.id,
          user_id: currentUser.id,
          content: content || null,
          image_url: imageUrl || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-posts'] });
      setNewPostContent('');
      setNewPostImageUrl('');
      setShowCreatePost(false);
      toast({ title: 'Post created!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!currentUser) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('studio_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-comments'] });
      setNewComment({});
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim() && !newPostImageUrl.trim()) {
      toast({ title: 'Please add content or an image', variant: 'destructive' });
      return;
    }
    createPostMutation.mutate({ content: newPostContent, imageUrl: newPostImageUrl });
  };

  const handleAddComment = (postId: string) => {
    const content = newComment[postId];
    if (!content?.trim()) return;
    createCommentMutation.mutate({ postId, content });
  };

  const getCommentsForPost = (postId: string) => {
    return comments?.filter(c => c.post_id === postId) || [];
  };

  if (studiosLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  // Studio detail view
  if (selectedStudio) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedStudio(null)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selectedStudio.icon}</span>
            <div>
              <h2 className="text-xl font-bold">{selectedStudio.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedStudio.description}</p>
            </div>
          </div>
        </div>

        {/* Create Post */}
        {currentUser ? (
          <Card>
            <CardContent className="pt-4">
              {showCreatePost ? (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Share something with the studio..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows={3}
                  />
                  <Input
                    placeholder="Image URL (optional)"
                    value={newPostImageUrl}
                    onChange={(e) => setNewPostImageUrl(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreatePost} disabled={createPostMutation.isPending}>
                      {createPostMutation.isPending ? 'Posting...' : 'Post'}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreatePost(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowCreatePost(true)}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Share a photo or post...
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-4 text-center text-muted-foreground">
              Sign in to post or comment
            </CardContent>
          </Card>
        )}

        {/* Posts */}
        {postsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.user_profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {post.user_profile?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {post.user_profile?.display_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(post.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {post.content && (
                    <p className="text-sm">{post.content}</p>
                  )}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="rounded-lg max-h-96 w-full object-cover"
                    />
                  )}

                  {/* Comments */}
                  <div className="border-t pt-4 space-y-3">
                    {getCommentsForPost(post.id).map((comment) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={comment.user_profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.user_profile?.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted rounded-lg px-3 py-2">
                          <p className="text-xs font-medium">
                            {comment.user_profile?.display_name || 'Anonymous'}
                          </p>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}

                    {/* Add Comment */}
                    {currentUser && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment..."
                          value={newComment[post.id] || ''}
                          onChange={(e) => setNewComment({ ...newComment, [post.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(post.id);
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleAddComment(post.id)}
                          disabled={createCommentMutation.isPending}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Studio grid view
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">NYU Tisch Studios</h2>
        <p className="text-muted-foreground">
          Connect with your studio community. Share photos, updates, and comments.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {studios?.map((studio) => (
          <Card
            key={studio.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => setSelectedStudio(studio)}
          >
            <CardContent className="p-6 text-center">
              <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">
                {studio.icon}
              </span>
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                {studio.name}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {studio.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SchoolStudios;
