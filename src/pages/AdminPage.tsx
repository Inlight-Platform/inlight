import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Shield, Newspaper, Image, Film, Theater, Upload, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import BroadwayShowsManager from '@/components/admin/BroadwayShowsManager';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // Redirect if not admin
  React.useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/feed');
        toast.error('Access denied. Admin privileges required.');
      }
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs defaultValue="broadway" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="broadway" className="gap-2">
              <Theater className="w-4 h-4" />
              ⭐ Broadway
            </TabsTrigger>
            <TabsTrigger value="off-broadway" className="gap-2">
              <Theater className="w-4 h-4" />
              🌟 Off-Broadway
            </TabsTrigger>
            <TabsTrigger value="off-off-broadway" className="gap-2">
              <Theater className="w-4 h-4" />
              ✨ Off-Off
            </TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2">
              <Newspaper className="w-4 h-4" />
              Highlights
            </TabsTrigger>
            <TabsTrigger value="film" className="gap-2">
              <Film className="w-4 h-4" />
              Film Metrics
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-2">
              <Image className="w-4 h-4" />
              Photos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="broadway">
            <BroadwayShowsManager category="broadway" />
          </TabsContent>

          <TabsContent value="off-broadway">
            <BroadwayShowsManager category="off-broadway" />
          </TabsContent>

          <TabsContent value="off-off-broadway">
            <BroadwayShowsManager category="off-off-broadway" />
          </TabsContent>

          <TabsContent value="highlights">
            <IndustryHighlightsManager />
          </TabsContent>

          <TabsContent value="film">
            <FilmMetricsManager />
          </TabsContent>

          <TabsContent value="photos">
            <PhotosManager />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

// Industry Highlights Manager Component
const IndustryHighlightsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<any>(null);
  const [formData, setFormData] = useState({
    content: '',
    category: 'general',
    date: new Date().toISOString().split('T')[0],
  });

  const { data: highlights, isLoading } = useQuery({
    queryKey: ['admin-highlights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industry_highlights')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('industry_highlights').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-highlights'] });
      toast.success('Highlight created successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create highlight: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('industry_highlights').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-highlights'] });
      toast.success('Highlight updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update highlight: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('industry_highlights').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-highlights'] });
      toast.success('Highlight deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete highlight: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ content: '', category: 'general', date: new Date().toISOString().split('T')[0] });
    setEditingHighlight(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (highlight: any) => {
    setEditingHighlight(highlight);
    setFormData({
      content: highlight.content,
      category: highlight.category,
      date: highlight.date,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHighlight) {
      updateMutation.mutate({ id: editingHighlight.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Industry Highlights</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Highlight
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHighlight ? 'Edit Highlight' : 'Add New Highlight'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter highlight content..."
                  required
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="broadway">Broadway</SelectItem>
                      <SelectItem value="film">Film</SelectItem>
                      <SelectItem value="tv">Television</SelectItem>
                      <SelectItem value="awards">Awards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingHighlight ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading highlights...</p>
        ) : highlights?.length === 0 ? (
          <p className="text-muted-foreground">No highlights yet. Add your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="max-w-md">Content</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highlights?.map((highlight) => (
                <TableRow key={highlight.id}>
                  <TableCell>{highlight.date}</TableCell>
                  <TableCell className="capitalize">{highlight.category}</TableCell>
                  <TableCell className="max-w-md truncate">{highlight.content}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(highlight)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(highlight.id)}
                      >
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

// Film Metrics Manager Component
const FilmMetricsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFilm, setEditingFilm] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    studio: '',
    weekend_gross: 0,
    total_gross: 0,
    week_change: 0,
    rating: 0,
    weeks_in_release: 1,
    date: new Date().toISOString().split('T')[0],
  });

  const { data: films, isLoading } = useQuery({
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
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('film_metrics').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film metrics added successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to add film metrics: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('film_metrics').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film metrics updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update film metrics: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('film_metrics').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-film-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['film-metrics'] });
      toast.success('Film metrics deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete film metrics: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      studio: '',
      weekend_gross: 0,
      total_gross: 0,
      week_change: 0,
      rating: 0,
      weeks_in_release: 1,
      date: new Date().toISOString().split('T')[0],
    });
    setEditingFilm(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (film: any) => {
    setEditingFilm(film);
    setFormData({
      title: film.title,
      studio: film.studio,
      weekend_gross: Number(film.weekend_gross),
      total_gross: Number(film.total_gross),
      week_change: Number(film.week_change),
      rating: Number(film.rating),
      weeks_in_release: film.weeks_in_release,
      date: film.date,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFilm) {
      updateMutation.mutate({ id: editingFilm.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Film Box Office Metrics</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Film
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingFilm ? 'Edit Film' : 'Add Film Metrics'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Movie title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Studio</Label>
                  <Input
                    value={formData.studio}
                    onChange={(e) => setFormData({ ...formData, studio: e.target.value })}
                    placeholder="e.g., Disney"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weekend Gross ($)</Label>
                  <Input
                    type="number"
                    value={formData.weekend_gross}
                    onChange={(e) => setFormData({ ...formData, weekend_gross: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Gross ($)</Label>
                  <Input
                    type="number"
                    value={formData.total_gross}
                    onChange={(e) => setFormData({ ...formData, total_gross: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Week Change (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.week_change}
                    onChange={(e) => setFormData({ ...formData, week_change: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Week #</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.weeks_in_release}
                    onChange={(e) => setFormData({ ...formData, weeks_in_release: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingFilm ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading films...</p>
        ) : films?.length === 0 ? (
          <p className="text-muted-foreground">No film metrics yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Studio</TableHead>
                <TableHead>Weekend</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {films?.map((film) => (
                <TableRow key={film.id}>
                  <TableCell>{film.date}</TableCell>
                  <TableCell className="font-medium">{film.title}</TableCell>
                  <TableCell>{film.studio}</TableCell>
                  <TableCell>{formatCurrency(Number(film.weekend_gross))}</TableCell>
                  <TableCell>{formatCurrency(Number(film.total_gross))}</TableCell>
                  <TableCell className={Number(film.week_change) >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {Number(film.week_change) >= 0 ? '+' : ''}{film.week_change}%
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(film)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(film.id)}
                      >
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

// Photos Manager Component
const PhotosManager: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: studioPosts, isLoading } = useQuery({
    queryKey: ['admin-studio-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_posts')
        .select('*, studios(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('studio_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-studio-posts'] });
      toast.success('Photo deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete photo: ' + error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Studio Photos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading photos...</p>
        ) : studioPosts?.length === 0 ? (
          <p className="text-muted-foreground">No studio photos found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {studioPosts?.map((post) => (
              <div key={post.id} className="relative group">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.content || 'Studio post'}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                  <p className="text-white text-xs text-center line-clamp-2">{post.content}</p>
                  <p className="text-white/70 text-xs">{(post.studios as any)?.name}</p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(post.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPage;
