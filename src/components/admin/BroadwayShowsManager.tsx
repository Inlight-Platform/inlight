import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Theater, Upload, X, Loader2, MessageSquare, MapPin, Calendar, Tag } from 'lucide-react';

interface ShowTip {
  id: string;
  show_id: string;
  tip_type: string;
  content: string;
  helpful_count: number;
}

type ShowCategory = 'broadway' | 'off-broadway' | 'off-off-broadway' | 'school';

interface ShowsManagerProps {
  category: ShowCategory;
}

const CATEGORY_LABELS: Record<ShowCategory, string> = {
  'broadway': 'Broadway',
  'off-broadway': 'Off-Broadway',
  'off-off-broadway': 'Off-Off-Broadway',
  'school': 'School',
};

const BroadwayShowsManager: React.FC<ShowsManagerProps> = ({ category }) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [newTip, setNewTip] = useState({ tip_type: 'seating', content: '' });
  const [activeTab, setActiveTab] = useState('details');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [badgeInput, setBadgeInput] = useState('');
  
  const categoryLabel = CATEGORY_LABELS[category];
  
  const [formData, setFormData] = useState({
    title: '',
    venue: '',
    borough: 'Manhattan',
    description: '',
    poster_url: '',
    show_type: 'musical',
    category: category,
    price_tier: 'moderate',
    run_start: '',
    run_end: '',
    show_times: '',
    rush_policy: '',
    lottery_info: '',
    official_url: '',
    badges: [] as string[],
  });

  // Fetch shows from nyc_shows based on category
  const { data: shows, isLoading } = useQuery({
    queryKey: ['admin-shows', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nyc_shows')
        .select('*')
        .eq('category', category)
        .order('title', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch tips for current show
  const { data: showTips, refetch: refetchTips } = useQuery({
    queryKey: ['admin-show-tips', editingShow?.id],
    queryFn: async () => {
      if (!editingShow?.id) return [];
      const { data, error } = await supabase
        .from('show_tips')
        .select('*')
        .eq('show_id', editingShow.id)
        .order('tip_type', { ascending: true });
      if (error) throw error;
      return data as ShowTip[];
    },
    enabled: !!editingShow?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<typeof formData>) => {
      const insertData = {
        title: data.title || '',
        venue: data.venue || '',
        borough: data.borough || 'Manhattan',
        description: data.description || null,
        poster_url: data.poster_url || null,
        show_type: data.show_type || 'musical',
        category: category,
        price_tier: data.price_tier || 'moderate',
        run_start: data.run_start && data.run_start.trim() !== '' ? data.run_start : null,
        run_end: data.run_end && data.run_end.trim() !== '' ? data.run_end : null,
        show_times: data.show_times || null,
        rush_policy: data.rush_policy || null,
        lottery_info: data.lottery_info || null,
        official_url: data.official_url || null,
        badges: data.badges || [],
      };
      const { error } = await supabase.from('nyc_shows').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shows', category] });
      queryClient.invalidateQueries({ queryKey: ['nyc-shows'] });
      toast.success(`${categoryLabel} show created successfully`);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create show: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      // Convert empty strings to null for date fields
      const sanitizedData = {
        ...data,
        run_start: data.run_start && data.run_start.trim() !== '' ? data.run_start : null,
        run_end: data.run_end && data.run_end.trim() !== '' ? data.run_end : null,
      };
      const { error } = await supabase.from('nyc_shows').update(sanitizedData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shows', category] });
      queryClient.invalidateQueries({ queryKey: ['nyc-shows'] });
      toast.success('Show updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update show: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nyc_shows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shows', category] });
      queryClient.invalidateQueries({ queryKey: ['nyc-shows'] });
      toast.success('Show deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete show: ' + error.message);
    },
  });

  // Tip mutations
  const addTipMutation = useMutation({
    mutationFn: async ({ show_id, tip_type, content }: { show_id: string; tip_type: string; content: string }) => {
      // Get the admin user ID for the tip
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase.from('show_tips').insert({
        show_id,
        tip_type,
        content,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTips();
      setNewTip({ tip_type: 'seating', content: '' });
      toast.success('Tip added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add tip: ' + error.message);
    },
  });

  const deleteTipMutation = useMutation({
    mutationFn: async (tipId: string) => {
      const { error } = await supabase.from('show_tips').delete().eq('id', tipId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTips();
      toast.success('Tip deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete tip: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      venue: '',
      borough: 'Manhattan',
      description: '',
      poster_url: '',
      show_type: 'musical',
      category: category,
      price_tier: 'moderate',
      run_start: '',
      run_end: '',
      show_times: '',
      rush_policy: '',
      lottery_info: '',
      official_url: '',
      badges: [],
    });
    setEditingShow(null);
    setIsDialogOpen(false);
    setActiveTab('details');
    setBadgeInput('');
  };

  const handleEdit = (show: any) => {
    setEditingShow(show);
    setFormData({
      title: show.title || '',
      venue: show.venue || '',
      borough: show.borough || 'Manhattan',
      description: show.description || '',
      poster_url: show.poster_url || '',
      show_type: show.show_type || 'musical',
      category: category,
      price_tier: show.price_tier || 'moderate',
      run_start: show.run_start || '',
      run_end: show.run_end || '',
      show_times: show.show_times || '',
      rush_policy: show.rush_policy || '',
      lottery_info: show.lottery_info || '',
      official_url: show.official_url || '',
      badges: show.badges || [],
    });
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${userData.user.id}/broadway-posters/${timestamp}-${randomId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      setFormData({ ...formData, poster_url: urlData.publicUrl });
      toast.success('Cover photo uploaded!');
    } catch (error: any) {
      toast.error('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, poster_url: '' });
  };

  const handleAddBadge = () => {
    if (badgeInput.trim() && !formData.badges.includes(badgeInput.trim())) {
      setFormData({ ...formData, badges: [...formData.badges, badgeInput.trim()] });
      setBadgeInput('');
    }
  };

  const handleRemoveBadge = (badge: string) => {
    setFormData({ ...formData, badges: formData.badges.filter(b => b !== badge) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShow) {
      updateMutation.mutate({ id: editingShow.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddTip = () => {
    if (!newTip.content.trim() || !editingShow?.id) return;
    addTipMutation.mutate({
      show_id: editingShow.id,
      tip_type: newTip.tip_type,
      content: newTip.content.trim(),
    });
  };

  const getTipTypeIcon = (type: string) => {
    switch (type) {
      case 'seating': return '💺';
      case 'parking': return '🚗';
      case 'food': return '🍕';
      case 'timing': return '⏰';
      default: return '💡';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Theater className="w-5 h-5 text-primary" />
            {categoryLabel} Shows (Industry Now)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all {categoryLabel} shows displayed on Industry Now page
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Show
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingShow ? `Edit: ${editingShow.title}` : `Add New ${categoryLabel} Show`}</DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="media">Media & Badges</TabsTrigger>
                <TabsTrigger value="tips" disabled={!editingShow}>Seating Tips</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleSubmit}>
                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Cover Photo - prominent at top */}
                  <div className="space-y-2">
                    <Label>Cover Photo</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    {formData.poster_url ? (
                      <div className="relative rounded-lg overflow-hidden border max-w-xs">
                        <img
                          src={formData.poster_url}
                          alt="Cover preview"
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleRemoveImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors max-w-xs"
                      >
                        {uploading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-muted-foreground">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <span className="text-muted-foreground">Click to upload cover photo</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Show title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Theatre
                      </Label>
                      <Input
                        value={formData.venue}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        placeholder="e.g., Gershwin Theatre"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description / Bio</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Show description..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Show Type</Label>
                      <Select value={formData.show_type} onValueChange={(v) => setFormData({ ...formData, show_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="musical">Musical</SelectItem>
                          <SelectItem value="play">Play</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Price Tier</Label>
                      <Select value={formData.price_tier} onValueChange={(v) => setFormData({ ...formData, price_tier: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="budget">Budget</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Run Start
                      </Label>
                      <Input
                        type="date"
                        value={formData.run_start}
                        onChange={(e) => setFormData({ ...formData, run_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Run End
                      </Label>
                      <Input
                        type="date"
                        value={formData.run_end}
                        onChange={(e) => setFormData({ ...formData, run_end: e.target.value })}
                        placeholder="Leave empty for ongoing"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Show Times</Label>
                    <Input
                      value={formData.show_times}
                      onChange={(e) => setFormData({ ...formData, show_times: e.target.value })}
                      placeholder="e.g., Tue-Sat 8pm, Wed & Sat 2pm, Sun 3pm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rush Policy</Label>
                      <Textarea
                        value={formData.rush_policy}
                        onChange={(e) => setFormData({ ...formData, rush_policy: e.target.value })}
                        placeholder="Rush ticket information..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lottery Info</Label>
                      <Textarea
                        value={formData.lottery_info}
                        onChange={(e) => setFormData({ ...formData, lottery_info: e.target.value })}
                        placeholder="Lottery ticket information..."
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Official Website URL</Label>
                    <Input
                      type="url"
                      value={formData.official_url}
                      onChange={(e) => setFormData({ ...formData, official_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="media" className="space-y-4 mt-4">
                  {/* Cover Photo */}
                  <div className="space-y-2">
                    <Label>Cover Photo</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    {formData.poster_url ? (
                      <div className="relative rounded-lg overflow-hidden border max-w-xs">
                        <img 
                          src={formData.poster_url} 
                          alt="Cover preview" 
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleRemoveImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors max-w-xs"
                      >
                        {uploading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-muted-foreground">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <span className="text-muted-foreground">Click to upload cover photo</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Badges */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Badges
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={badgeInput}
                        onChange={(e) => setBadgeInput(e.target.value)}
                        placeholder="e.g., Tony Winner, Closing Soon"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBadge())}
                      />
                      <Button type="button" variant="outline" onClick={handleAddBadge}>
                        Add
                      </Button>
                    </div>
                    {formData.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.badges.map((badge) => (
                          <Badge key={badge} variant="secondary" className="gap-1">
                            {badge}
                            <button
                              type="button"
                              onClick={() => handleRemoveBadge(badge)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="tips" className="space-y-4 mt-4">
                  {editingShow && (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Add New Tip
                        </Label>
                        <div className="flex gap-2">
                          <Select value={newTip.tip_type} onValueChange={(v) => setNewTip({ ...newTip, tip_type: v })}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seating">💺 Seating</SelectItem>
                              <SelectItem value="parking">🚗 Parking</SelectItem>
                              <SelectItem value="food">🍕 Food</SelectItem>
                              <SelectItem value="timing">⏰ Timing</SelectItem>
                              <SelectItem value="general">💡 General</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={newTip.content}
                            onChange={(e) => setNewTip({ ...newTip, content: e.target.value })}
                            placeholder="Enter tip content..."
                            className="flex-1"
                          />
                          <Button 
                            type="button" 
                            onClick={handleAddTip}
                            disabled={addTipMutation.isPending}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Existing Tips</Label>
                        {showTips && showTips.length > 0 ? (
                          <div className="space-y-2">
                            {showTips.map((tip) => (
                              <div key={tip.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                                <span className="text-lg">{getTipTypeIcon(tip.tip_type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm">{tip.content}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tip.helpful_count} helpful votes
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive shrink-0"
                                  onClick={() => deleteTipMutation.mutate(tip.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No tips yet. Add the first one above!
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>
                
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingShow ? 'Update Show' : 'Create Show'}
                  </Button>
                </div>
              </form>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading Broadway shows...</p>
        ) : shows?.length === 0 ? (
          <p className="text-muted-foreground">No Broadway shows yet. Add your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Theatre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Run Dates</TableHead>
                <TableHead>Badges</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shows?.map((show) => (
                <TableRow key={show.id}>
                  <TableCell>
                    {show.poster_url ? (
                      <img 
                        src={show.poster_url} 
                        alt={show.title} 
                        className="w-12 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded bg-muted flex items-center justify-center">
                        <Theater className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{show.title}</TableCell>
                  <TableCell>{show.venue}</TableCell>
                  <TableCell className="capitalize">{show.show_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {show.run_start ? new Date(show.run_start).toLocaleDateString() : '-'}
                    {show.run_end ? ` - ${new Date(show.run_end).toLocaleDateString()}` : ' - Ongoing'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(show.badges as string[] || []).slice(0, 2).map((badge: string) => (
                        <Badge key={badge} variant="outline" className="text-xs">
                          {badge}
                        </Badge>
                      ))}
                      {(show.badges as string[] || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(show.badges as string[]).length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(show)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${show.title}"?`)) {
                            deleteMutation.mutate(show.id);
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
        )}
      </CardContent>
    </Card>
  );
};

export default BroadwayShowsManager;
