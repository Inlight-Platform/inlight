import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';

const INDUSTRIES = ['theatre', 'film', 'music', 'both'] as const;
const CATEGORIES = ['news', 'directories', 'education', 'union', 'casting', 'scripts'] as const;
const EDUCATION_TYPES = [
  'acting', 'filmmaking', 'producing', 'dance', 'voice',
  'instrument', 'songwriting', 'production', 'general',
] as const;

type ResourceRow = {
  id: string;
  name: string;
  description: string;
  url: string;
  industry: string;
  category: string;
  education_type: string | null;
  is_education: boolean;
  is_active: boolean;
  display_order: number;
};

const emptyForm = {
  name: '',
  description: '',
  url: '',
  industry: 'theatre',
  category: 'directories',
  education_type: '' as string,
  is_education: false,
  is_active: true,
  display_order: 999,
};

const ResourcesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [industryFilter, setIndustryFilter] = useState<'all' | string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  const { data: resources, isLoading } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('industry', { ascending: true })
        .order('category', { ascending: true })
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as ResourceRow[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: typeof formData & { id?: string }) => {
      const row = {
        name: payload.name.trim(),
        description: payload.description.trim(),
        url: payload.url.trim() || '#',
        industry: payload.industry,
        category: payload.is_education ? 'education' : payload.category,
        education_type: payload.is_education
          ? (payload.education_type || 'general')
          : null,
        is_education: payload.is_education,
        is_active: payload.is_active,
        display_order: Number.isFinite(payload.display_order) ? payload.display_order : 999,
      };
      if (payload.id) {
        const { error } = await supabase.from('resources').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('resources').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['public-resources'] });
      toast.success(editingId ? 'Resource updated' : 'Resource created');
      resetForm();
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['public-resources'] });
      toast.success('Resource deleted');
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('resources')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['public-resources'] });
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (r: ResourceRow) => {
    setEditingId(r.id);
    setFormData({
      name: r.name,
      description: r.description ?? '',
      url: r.url,
      industry: r.industry,
      category: r.category,
      education_type: r.education_type ?? '',
      is_education: r.is_education,
      is_active: r.is_active,
      display_order: r.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    upsertMutation.mutate({ ...formData, id: editingId ?? undefined });
  };

  const filtered = (resources ?? []).filter(r =>
    industryFilter === 'all' ? true : r.industry === industryFilter
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Resources</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, or remove items shown on the public Resources page.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setFormData({ ...emptyForm }); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Resource name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 60) })}
                  placeholder="Short description (max 60 characters, fits on one line)"
                  rows={2}
                  maxLength={60}
                />
                <div className="text-xs text-muted-foreground text-right">
                  {formData.description.length}/60
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL *</Label>
                <Input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(v) => setFormData({ ...formData, industry: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i} className="capitalize">{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="cursor-pointer">Education program</Label>
                  <p className="text-xs text-muted-foreground">Show in the Education & Programs section</p>
                </div>
                <Switch
                  checked={formData.is_education}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    is_education: checked,
                    category: checked ? 'education' : formData.category === 'education' ? 'directories' : formData.category,
                  })}
                />
              </div>
              {formData.is_education ? (
                <div className="space-y-2">
                  <Label>Education Type</Label>
                  <Select
                    value={formData.education_type || 'general'}
                    onValueChange={(v) => setFormData({ ...formData, education_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== 'education').map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Visible on Resources page</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={industryFilter} onValueChange={setIndustryFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({resources?.length ?? 0})</TabsTrigger>
            {INDUSTRIES.map((i) => (
              <TabsTrigger key={i} value={i} className="capitalize">
                {i} ({(resources ?? []).filter(r => r.industry === i).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <p className="text-muted-foreground">Loading resources...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No resources yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Industry</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">URL</TableHead>
                  <TableHead>Visible</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-[220px]">
                      <div className="line-clamp-1">{r.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell capitalize">{r.industry}</TableCell>
                    <TableCell className="hidden md:table-cell capitalize">
                      {r.is_education ? `Education · ${r.education_type ?? 'general'}` : r.category}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[220px]">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{r.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: r.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${r.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(r.id);
                            }
                          }}
                        >
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
      </CardContent>
    </Card>
  );
};

export default ResourcesManager;