import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Pencil, Save, X, Film, Music, Mic2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionnaireAnswers {
  favorite_movie: string | null;
  favorite_artist: string | null;
  favorite_song: string | null;
  why_artist: string | null;
}

interface WhyIStartedProps {
  userId: string;
  isOwnProfile: boolean;
}

const QUESTIONS = [
  {
    key: 'favorite_movie' as const,
    label: "What's your current favorite movie?",
    icon: Film,
    placeholder: 'e.g., Moonlight, Lady Bird, Everything Everywhere All at Once...',
    maxLength: 200,
  },
  {
    key: 'favorite_artist' as const,
    label: "Who's your current favorite artist?",
    icon: Sparkles,
    placeholder: 'e.g., Phoebe Bridgers, Kendrick Lamar, Bon Iver...',
    maxLength: 200,
  },
  {
    key: 'favorite_song' as const,
    label: "What's your current favorite song?",
    icon: Music,
    placeholder: 'e.g., Motion Sickness, Alright, Skinny Love...',
    maxLength: 200,
  },
  {
    key: 'why_artist' as const,
    label: 'What made you want to be an artist?',
    icon: Mic2,
    placeholder: 'Share your story—what moment, person, or experience sparked your passion?',
    maxLength: 1000,
    multiline: true,
  },
];

export const WhyIStarted: React.FC<WhyIStartedProps> = ({
  userId,
  isOwnProfile,
}) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editAnswers, setEditAnswers] = useState<QuestionnaireAnswers>({
    favorite_movie: null,
    favorite_artist: null,
    favorite_song: null,
    why_artist: null,
  });

  // Fetch answers from profile
  const { data: answers, isLoading } = useQuery({
    queryKey: ['why-i-started-answers', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_movie, favorite_artist, favorite_song, why_artist')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as QuestionnaireAnswers | null;
    },
    enabled: !!userId,
  });

  // Sync edit state when data loads
  useEffect(() => {
    if (answers) {
      setEditAnswers({
        favorite_movie: answers.favorite_movie || null,
        favorite_artist: answers.favorite_artist || null,
        favorite_song: answers.favorite_song || null,
        why_artist: answers.why_artist || null,
      });
    }
  }, [answers]);

  const saveMutation = useMutation({
    mutationFn: async (newAnswers: QuestionnaireAnswers) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          favorite_movie: newAnswers.favorite_movie?.trim() || null,
          favorite_artist: newAnswers.favorite_artist?.trim() || null,
          favorite_song: newAnswers.favorite_song?.trim() || null,
          why_artist: newAnswers.why_artist?.trim() || null,
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['why-i-started-answers', userId] });
      setIsEditing(false);
      toast.success('Answers saved!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save answers');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(editAnswers);
  };

  const handleCancel = () => {
    setEditAnswers({
      favorite_movie: answers?.favorite_movie || null,
      favorite_artist: answers?.favorite_artist || null,
      favorite_song: answers?.favorite_song || null,
      why_artist: answers?.why_artist || null,
    });
    setIsEditing(false);
  };

  const hasAnyAnswers = answers && Object.values(answers).some(v => v?.trim());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Why I Started</h3>
          <p className="text-sm text-muted-foreground">
            Your artistic inspirations and favorites
          </p>
        </div>
        
        {isOwnProfile && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
        
        {isOwnProfile && isEditing && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={saveMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {!hasAnyAnswers && !isEditing ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {isOwnProfile 
              ? "Share your artistic inspirations—click Edit to answer a few questions."
              : "No answers shared yet."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {QUESTIONS.map((question) => {
            const Icon = question.icon;
            const value = isEditing 
              ? editAnswers[question.key] || ''
              : answers?.[question.key] || '';

            if (!isEditing && !value) return null;

            return (
              <div key={question.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <label className="text-sm font-medium">{question.label}</label>
                </div>
                
                {isEditing ? (
                  question.multiline ? (
                    <div>
                      <Textarea
                        value={value}
                        onChange={(e) => setEditAnswers(prev => ({
                          ...prev,
                          [question.key]: e.target.value,
                        }))}
                        placeholder={question.placeholder}
                        className="min-h-[120px] resize-none"
                        maxLength={question.maxLength}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {value.length}/{question.maxLength}
                      </p>
                    </div>
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => setEditAnswers(prev => ({
                        ...prev,
                        [question.key]: e.target.value,
                      }))}
                      placeholder={question.placeholder}
                      maxLength={question.maxLength}
                    />
                  )
                ) : (
                  <div className={cn(
                    "p-3 rounded-lg bg-muted/50",
                    question.multiline && "whitespace-pre-wrap"
                  )}>
                    <p className="text-sm">{value}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};