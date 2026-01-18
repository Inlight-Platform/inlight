import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface PostCreatorProps {
  userProfile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const PostCreator: React.FC<PostCreatorProps> = ({ userProfile }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Post created!');
    },
    onError: () => toast.error('Failed to create post'),
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    createPostMutation.mutate();
  };

  if (!user) return null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={userProfile?.avatar_url || undefined} />
            <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Share something with your network..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            
            {showImageInput && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Image URL (optional)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowImageInput(false);
                    setImageUrl('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden max-h-48">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImageInput(!showImageInput)}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Image
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim() || createPostMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
