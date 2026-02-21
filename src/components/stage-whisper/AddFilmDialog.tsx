import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ImagePlus, X, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface AddFilmDialogProps {
  trigger?: React.ReactNode;
}

export const AddFilmDialog: React.FC<AddFilmDialogProps> = ({ trigger }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLinkUrl('');
    setIsAnonymous(false);
    setPosterFile(null);
    setPosterPreview(null);
  };

  const handlePosterSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setPosterFile(file);
    const reader = new FileReader();
    reader.onload = () => setPosterPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePoster = () => {
    setPosterFile(null);
    setPosterPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in');
      if (!title.trim()) throw new Error('Title is required');
      if (!linkUrl.trim()) throw new Error('A link is required');
      if (!posterFile) throw new Error('An image is required');

      // Insert film
      const { data: filmData, error: insertError } = await supabase
        .from('user_films')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          link_url: linkUrl.trim(),
          submitted_by: user.id,
          is_anonymous: isAnonymous,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Upload poster
      if (filmData?.id) {
        const fileExt = posterFile.name.split('.').pop();
        const fileName = `films/${filmData.id}/poster.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-media')
          .upload(fileName, posterFile, { upsert: true, contentType: posterFile.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
        await supabase.from('user_films').update({ poster_url: urlData.publicUrl }).eq('id', filmData.id);
      }
    },
    onSuccess: () => {
      toast.success('Your film has been added! 🎬');
      queryClient.invalidateQueries({ queryKey: ['user-films'] });
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit film');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Film</Button>}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in Required</DialogTitle>
            <DialogDescription>You need to be signed in to add a film.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Film</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Your Film</DialogTitle>
          <DialogDescription>Share a student film or a film you worked on</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Poster Image */}
          <div className="space-y-2">
            <Label>Film Poster / Image *</Label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePosterSelect} className="hidden" />
            {posterPreview ? (
              <div className="relative w-full aspect-[2/3] max-w-[200px] rounded-lg overflow-hidden border border-border">
                <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
                <button type="button" onClick={removePoster} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-[2/3] max-w-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm">Add poster image</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="film-title">Title *</Label>
            <Input id="film-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Film title" maxLength={100} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="film-link">Link *</Label>
            <Input id="film-link" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." maxLength={500} required />
            <p className="text-xs text-muted-foreground">YouTube, Vimeo, or any link to your film</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="film-desc">Description</Label>
            <Textarea id="film-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." maxLength={500} rows={3} />
          </div>

          {/* Anonymous */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <EyeOff className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <Label htmlFor="film-anon" className="text-sm font-medium">Post Anonymously</Label>
              <p className="text-xs text-muted-foreground">Your name won't be shown</p>
            </div>
            <Switch id="film-anon" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitMutation.isPending} className="gap-2">
              {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Film
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
