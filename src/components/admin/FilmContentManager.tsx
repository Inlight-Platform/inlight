import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Film, Tv, Upload, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ContentType = 'theatres' | 'streaming';

interface FilmContentManagerProps {
  contentType: ContentType;
}

const CONTENT_LABELS: Record<ContentType, { title: string; description: string }> = {
  theatres: { 
    title: 'Films In Theatres', 
    description: 'Manage films currently showing in movie theatres' 
  },
  streaming: { 
    title: 'Streaming Content', 
    description: 'Manage top streaming movies and TV shows' 
  },
};

const PLATFORMS = [
  'Netflix', 'HBO Max', 'Disney+', 'Hulu', 'Amazon Prime', 
  'Apple TV+', 'Peacock', 'Paramount+', 'Max', 'Other'
];

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 
  'Romance', 'Documentary', 'Animation', 'Fantasy', 'Crime', 'Other'
];

const FilmContentManager: React.FC<FilmContentManagerProps> = ({ contentType }) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const labels = CONTENT_LABELS[contentType];
  const isTheatres = contentType === 'theatres';

  // Form state for theatres (film_metrics)
  const [theatreForm, setTheatreForm] = useState({
    title: '',
    studio: '',
    rating: 0,
    poster_url: '',
    date: new Date().toISOString().split('T')[0],
    ticket_url: '',
  });

  // Form state for streaming
  const [streamingForm, setStreamingForm] = useState({
    title: '',
    content_type: 'movie' as 'movie' | 'tv',
    platform: 'Netflix',
    description: '',
    poster_url: '',
    genre: 'Drama',
    release_year: new Date().getFullYear(),
    rating: 0,
    watch_url: '',
  });

  // Fetch theatres data
  const { data: theatreFilms, isLoading: loadingTheatres } = useQuery({
    queryKey: ['admin-film-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('film_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isTheatres,
  });

  // Fetch streaming data
  const { data: streamingContent, isLoading: loadingStreaming } = useQuery({
    queryKey: ['admin-streaming-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streaming_content')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !isTheatres,
  });

  // Theatre mutations
  const createTheatreMutation = useMutation({
    mutationFn: async (data: typeof theatreForm) => {
      const { error } = await supabase.from('film_metrics').insert({
        title: data.title,
        studio: data.studio,
        rating: data.rating,
        poster_url: data.poster_url || null,
        date: data.date,
        weekend_gross: 0,
        total_gross: 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film added successfully');
      resetForm();
    },
    onError: (error) => toast.error('Failed to add film: ' + error.message),
  });

  const updateTheatreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof theatreForm }) => {
      const { error } = await supabase.from('film_metrics').update({
        title: data.title,
        studio: data.studio,
        rating: data.rating,
        poster_url: data.poster_url || null,
        date: data.date,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film updated successfully');
      resetForm();
    },
    onError: (error) => toast.error('Failed to update film: ' + error.message),
  });

  const deleteTheatreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('film_metrics').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film deleted successfully');
    },
    onError: (error) => toast.error('Failed to delete film: ' + error.message),
  });

  // Streaming mutations
  const createStreamingMutation = useMutation({
    mutationFn: async (data: typeof streamingForm) => {
      const { error } = await supabase.from('streaming_content').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-streaming-content'] });
      queryClient.invalidateQueries({ queryKey: ['streaming-content'] });
      toast.success('Streaming content added successfully');
      resetForm();
    },
    onError: (error) => toast.error('Failed to add content: ' + error.message),
  });

  const updateStreamingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof streamingForm }) => {
      const { error } = await supabase.from('streaming_content').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-streaming-content'] });
      queryClient.invalidateQueries({ queryKey: ['streaming-content'] });
      toast.success('Content updated successfully');
      resetForm();
    },
    onError: (error) => toast.error('Failed to update content: ' + error.message),
  });

  const deleteStreamingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('streaming_content').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-streaming-content'] });
      queryClient.invalidateQueries({ queryKey: ['streaming-content'] });
      toast.success('Content deleted successfully');
    },
    onError: (error) => toast.error('Failed to delete content: ' + error.message),
  });

  const resetForm = () => {
    setTheatreForm({
      title: '',
      studio: '',
      rating: 0,
      poster_url: '',
      date: new Date().toISOString().split('T')[0],
      ticket_url: '',
    });
    setStreamingForm({
      title: '',
      content_type: 'movie',
      platform: 'Netflix',
      description: '',
      poster_url: '',
      genre: 'Drama',
      release_year: new Date().getFullYear(),
      rating: 0,
      watch_url: '',
    });
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (isTheatres) {
      setTheatreForm({
        title: item.title || '',
        studio: item.studio || '',
        rating: Number(item.rating) || 0,
        poster_url: item.poster_url || '',
        date: item.date || new Date().toISOString().split('T')[0],
        ticket_url: item.ticket_url || '',
      });
    } else {
      setStreamingForm({
        title: item.title || '',
        content_type: item.content_type || 'movie',
        platform: item.platform || 'Netflix',
        description: item.description || '',
        poster_url: item.poster_url || '',
        genre: item.genre || 'Drama',
        release_year: item.release_year || new Date().getFullYear(),
        rating: Number(item.rating) || 0,
        watch_url: item.watch_url || '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `film-posters/${timestamp}-${randomId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      if (isTheatres) {
        setTheatreForm({ ...theatreForm, poster_url: urlData.publicUrl });
      } else {
        setStreamingForm({ ...streamingForm, poster_url: urlData.publicUrl });
      }
      toast.success('Poster uploaded!');
    } catch (error: any) {
      toast.error('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTheatres) {
      if (editingItem) {
        updateTheatreMutation.mutate({ id: editingItem.id, data: theatreForm });
      } else {
        createTheatreMutation.mutate(theatreForm);
      }
    } else {
      if (editingItem) {
        updateStreamingMutation.mutate({ id: editingItem.id, data: streamingForm });
      } else {
        createStreamingMutation.mutate(streamingForm);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (isTheatres) {
      deleteTheatreMutation.mutate(id);
    } else {
      deleteStreamingMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const isLoading = isTheatres ? loadingTheatres : loadingStreaming;
  const items = isTheatres ? theatreFilms : streamingContent;
  const posterUrl = isTheatres ? theatreForm.poster_url : streamingForm.poster_url;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {isTheatres ? <Film className="w-5 h-5 text-primary" /> : <Tv className="w-5 h-5 text-primary" />}
            {labels.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{labels.description}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add {isTheatres ? 'Film' : 'Content'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? `Edit: ${editingItem.title}` : `Add New ${isTheatres ? 'Film' : 'Streaming Content'}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Poster Upload */}
              <div className="space-y-2">
                <Label>Poster Image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {posterUrl ? (
                  <div className="relative w-32 h-48 rounded-lg overflow-hidden border">
                    <img src={posterUrl} alt="Poster" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => isTheatres 
                        ? setTheatreForm({ ...theatreForm, poster_url: '' })
                        : setStreamingForm({ ...streamingForm, poster_url: '' })
                      }
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {uploading ? 'Uploading...' : 'Upload Poster'}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={isTheatres ? theatreForm.title : streamingForm.title}
                  onChange={(e) => isTheatres 
                    ? setTheatreForm({ ...theatreForm, title: e.target.value })
                    : setStreamingForm({ ...streamingForm, title: e.target.value })
                  }
                  placeholder="Title"
                  required
                />
              </div>

              {isTheatres ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Studio</Label>
                      <Input
                        value={theatreForm.studio}
                        onChange={(e) => setTheatreForm({ ...theatreForm, studio: e.target.value })}
                        placeholder="e.g., Disney"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rating (0-10)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={theatreForm.rating}
                        onChange={(e) => setTheatreForm({ ...theatreForm, rating: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ticket URL</Label>
                      <Input
                        type="url"
                        value={theatreForm.ticket_url}
                        onChange={(e) => setTheatreForm({ ...theatreForm, ticket_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={theatreForm.date}
                        onChange={(e) => setTheatreForm({ ...theatreForm, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select 
                        value={streamingForm.content_type} 
                        onValueChange={(v) => setStreamingForm({ ...streamingForm, content_type: v as 'movie' | 'tv' })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="movie">Movie</SelectItem>
                          <SelectItem value="tv">TV Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select 
                        value={streamingForm.platform} 
                        onValueChange={(v) => setStreamingForm({ ...streamingForm, platform: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Select 
                        value={streamingForm.genre} 
                        onValueChange={(v) => setStreamingForm({ ...streamingForm, genre: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Release Year</Label>
                      <Input
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        value={streamingForm.release_year}
                        onChange={(e) => setStreamingForm({ ...streamingForm, release_year: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Rating (0-10)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={streamingForm.rating}
                      onChange={(e) => setStreamingForm({ ...streamingForm, rating: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={streamingForm.description}
                      onChange={(e) => setStreamingForm({ ...streamingForm, description: e.target.value })}
                      placeholder="Brief description..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">{editingItem ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !items?.length ? (
          <p className="text-muted-foreground">No content yet. Add your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poster</TableHead>
                <TableHead>Title</TableHead>
                {isTheatres ? (
                  <>
                    <TableHead>Studio</TableHead>
                    <TableHead>Ticket URL</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Type</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Genre</TableHead>
                  </>
                )}
                <TableHead>Rating</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.poster_url ? (
                      <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                        <Film className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  {isTheatres ? (
                    <>
                      <TableCell>{item.studio}</TableCell>
                      <TableCell>
                        {item.ticket_url ? (
                          <a href={item.ticket_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs truncate max-w-[120px] block">Link</a>
                        ) : '—'}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Badge variant={item.content_type === 'tv' ? 'secondary' : 'outline'}>
                          {item.content_type === 'tv' ? 'TV' : 'Movie'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.platform}</TableCell>
                      <TableCell>{item.genre}</TableCell>
                    </>
                  )}
                  <TableCell>⭐ {Number(item.rating).toFixed(1)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default FilmContentManager;
