import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Edit, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MusicShow {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  show_date: string | null;
  ticket_url: string | null;
  poster_url: string | null;
  is_free: boolean | null;
  is_active: boolean | null;
  is_anonymous: boolean | null;
  submitted_by: string;
  created_at: string;
}

const emptyForm = {
  title: '',
  description: '',
  venue: '',
  show_date: '',
  ticket_url: '',
  poster_url: '',
  is_free: false,
  is_active: true,
};

const MusicShowsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MusicShow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: shows, isLoading } = useQuery({
    queryKey: ['admin-music-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_music_shows')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MusicShow[];
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditing(null);
    setIsDialogOpen(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const { error } = await supabase.from('user_music_shows').insert({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        venue: formData.venue.trim() || null,
        show_date: formData.show_date || null,
        ticket_url: formData.is_free ? null : (formData.ticket_url.trim() || null),
        poster_url: formData.poster_url.trim() || null,
        is_free: formData.is_free,
        is_active: formData.is_active,
        submitted_by: userData.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-music-shows'] });
      queryClient.invalidateQueries({ queryKey: ['user-music-shows'] });
      toast.success('Music show created');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from('user_music_shows')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          venue: formData.venue.trim() || null,
          show_date: formData.show_date || null,
          ticket_url: formData.is_free ? null : (formData.ticket_url.trim() || null),
          poster_url: formData.poster_url.trim() || null,
          is_free: formData.is_free,
          is_active: formData.is_active,
        })
        .eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-music-shows'] });
      queryClient.invalidateQueries({ queryKey: ['user-music-shows'] });
      toast.success('Music show updated');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_music_shows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-music-shows'] });
      queryClient.invalidateQueries({ queryKey: ['user-music-shows'] });
      toast.success('Music show deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEdit = (show: MusicShow) => {
    setEditing(show);
    setFormData({
      title: show.title,
      description: show.description || '',
      venue: show.venue || '',
      show_date: show.show_date ? show.show_date.slice(0, 16) : '',
      ticket_url: show.ticket_url || '',
      poster_url: show.poster_url || '',
      is_free: !!show.is_free,
      is_active: show.is_active !== false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error('Title is required'); return; }
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Music Shows</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setFormData(emptyForm); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Music Show
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Music Show' : 'Add Music Show'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Show Date & Time</Label>
                <Input type="datetime-local" value={formData.show_date} onChange={(e) => setFormData({ ...formData, show_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Poster Image URL</Label>
                <Input type="url" value={formData.poster_url} onChange={(e) => setFormData({ ...formData, poster_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="music-free-admin" checked={formData.is_free} onCheckedChange={(v) => setFormData({ ...formData, is_free: v === true })} />
                <Label htmlFor="music-free-admin" className="text-sm">Free show</Label>
              </div>
              {!formData.is_free && (
                <div className="space-y-2">
                  <Label>Ticket URL</Label>
                  <Input type="url" value={formData.ticket_url} onChange={(e) => setFormData({ ...formData, ticket_url: e.target.value })} placeholder="https://..." />
                </div>
              )}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} maxLength={1000} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="music-active-admin" checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v === true })} />
                <Label htmlFor="music-active-admin" className="text-sm">Active (visible to users)</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="gap-2">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading music shows...</p>
        ) : !shows || shows.length === 0 ? (
          <p className="text-muted-foreground">No music shows yet. Add the first one!</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Poster</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shows.map((show) => (
                  <TableRow key={show.id}>
                    <TableCell>
                      {show.poster_url ? (
                        <img src={show.poster_url} alt={show.title} className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-muted rounded" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{show.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{show.venue || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {show.show_date ? new Date(show.show_date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${show.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {show.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(show)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(show.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DeleteConfirmDialog
          open={!!deleteId}
          onOpenChange={(o) => { if (!o) setDeleteId(null); }}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          title="Delete this music show?"
          description="This will permanently remove it from the Music tab for everyone."
          isPending={deleteMutation.isPending}
        />
      </CardContent>
    </Card>
  );
};

export default MusicShowsManager;