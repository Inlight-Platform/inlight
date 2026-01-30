import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Shield, Newspaper, Image, Film, Theater, Upload, X, Loader2, Tv } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import BroadwayShowsManager from '@/components/admin/BroadwayShowsManager';
import FilmContentManager from '@/components/admin/FilmContentManager';

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
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="broadway" className="space-y-4">
        <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto gap-1 p-1">
            <TabsTrigger value="broadway" className="gap-2 whitespace-nowrap">
              <Theater className="w-4 h-4" />
              <span className="hidden sm:inline">⭐</span> Broadway
            </TabsTrigger>
            <TabsTrigger value="off-broadway" className="gap-2 whitespace-nowrap">
              <Theater className="w-4 h-4" />
              <span className="hidden sm:inline">🌟</span> Off-Bway
            </TabsTrigger>
            <TabsTrigger value="off-off-broadway" className="gap-2 whitespace-nowrap">
              <Theater className="w-4 h-4" />
              <span className="hidden sm:inline">✨</span> Off-Off
            </TabsTrigger>
            <TabsTrigger value="film-theatres" className="gap-2 whitespace-nowrap">
              <Film className="w-4 h-4" />
              <span className="hidden sm:inline">🎬</span> Theatres
            </TabsTrigger>
            <TabsTrigger value="film-streaming" className="gap-2 whitespace-nowrap">
              <Tv className="w-4 h-4" />
              <span className="hidden sm:inline">📺</span> Streaming
            </TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2 whitespace-nowrap">
              <Newspaper className="w-4 h-4" />
              <span className="hidden sm:inline">Highlights</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-2 whitespace-nowrap">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Photos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="broadway">
          <BroadwayShowsManager category="broadway" />
        </TabsContent>

        <TabsContent value="off-broadway">
          <BroadwayShowsManager category="off-broadway" />
        </TabsContent>

        <TabsContent value="off-off-broadway">
          <BroadwayShowsManager category="off-off-broadway" />
        </TabsContent>

        <TabsContent value="film-theatres">
          <FilmContentManager contentType="theatres" />
        </TabsContent>

        <TabsContent value="film-streaming">
          <FilmContentManager contentType="streaming" />
        </TabsContent>

        <TabsContent value="highlights">
          <IndustryHighlightsManager />
        </TabsContent>

        <TabsContent value="photos">
          <PhotosManager />
        </TabsContent>
      </Tabs>
    </div>
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
