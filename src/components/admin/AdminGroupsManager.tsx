import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Building2, Edit, ExternalLink, Loader2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type AdminGroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  active_member_count: number;
  active_admin_count: number;
};

type CreateGroupResult = {
  group: Pick<AdminGroupRow, 'id' | 'name' | 'slug'>;
  results: AdminResult[];
};

type AdminResult = { email: string; outcome: string; status?: string | null; error?: string; delivery?: string };

type GroupFormState = {
  name: string;
  slug: string;
  description: string;
  initialAdminEmail: string;
};

const emptyForm: GroupFormState = {
  name: '',
  slug: '',
  description: '',
  initialAdminEmail: '',
};

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: string })?.message;
  const code = (error as { code?: string })?.code;
  const details = (error as { details?: string })?.details;
  const combined = `${code || ''} ${message || ''} ${details || ''}`.toLowerCase();

  if (combined.includes('groups_slug_key') || (combined.includes('duplicate key') && combined.includes('slug'))) {
    return 'That group URL slug is already in use. Choose a different slug.';
  }

  return message || fallback;
};

const AdminGroupsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroupRow | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminResults, setAdminResults] = useState<AdminResult[]>([]);
  const [addingGroup, setAddingGroup] = useState<AdminGroupRow | null>(null);
  const [addEmail, setAddEmail] = useState('');

  const { data: groups = [], isLoading, isError, error } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_groups');
      if (error) throw error;
      return (data || []) as AdminGroupRow[];
    },
  });

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const resetCreateForm = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setIsCreateOpen(false);
  };

  const resetEditForm = () => {
    setEditingGroup(null);
    setForm(emptyForm);
    setSlugTouched(false);
  };

  const updateName = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : normalizeSlug(name),
    }));
  };

  const updateSlug = (slug: string) => {
    setSlugTouched(true);
    setForm((current) => ({ ...current, slug: normalizeSlug(slug) }));
  };

  const deliverInvite = async (group: Pick<AdminGroupRow, 'id' | 'name' | 'slug'>, result: AdminResult): Promise<AdminResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-group-admin-invite', {
        body: { groupId: group.id, email: result.email, note: `You've been invited to administer ${group.name} on Inlight.` },
      });
      if (error || !data?.invite) return { ...result, delivery: 'Delivery outcome unknown; check before retrying.' };
      const status = data.invite.status as string;
      const delivery = data.email?.notRequired ? 'Email not required' : data.email?.sent
        ? 'Invitation email sent' : 'Invitation email failed';
      return { ...result, status, delivery };
    } catch {
      return { ...result, delivery: 'Delivery outcome unknown; check before retrying.' };
    }
  };

  const createGroup = useMutation({
    mutationFn: async () => {
      const emails = form.initialAdminEmail.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean);
      if (!emails.some((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
        setAdminResults(emails.map((email) => ({ email, outcome: 'invalid' })));
        throw new Error('At least one valid admin email is required');
      }
      const { data, error } = await supabase.rpc('admin_create_group_with_admins', {
        _name: form.name.trim(),
        _slug: normalizeSlug(form.slug),
        _description: form.description.trim() || null,
        _admin_emails: emails,
      });

      if (error) {
        if (error.code) throw error;
        throw new Error('Creation outcome unknown; check the department list before retrying.');
      }

      const { group, results } = data;
      const delivered = await Promise.all(results.map((result) => result.outcome === 'assigned' && result.status === 'pending'
        ? deliverInvite(group, result) : Promise.resolve(result.outcome === 'assigned' ? { ...result, delivery: 'Email not required' } : result)));
      return { group, results: delivered } satisfies CreateGroupResult;
    },
    onSuccess: (result) => {
      setAdminResults(result.results);
      toast.success('Department portal created; see admin results below');
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      resetCreateForm();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create department portal')),
  });

  const addAdmin = useMutation({
    mutationFn: async () => {
      if (!addingGroup) throw new Error('Group is required');
      const email = addEmail.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke('send-group-admin-invite', {
        body: { groupId: addingGroup.id, email, note: `You've been invited to administer ${addingGroup.name} on Inlight.` },
      });
      if (error || !data?.invite) return { email, outcome: 'unknown', delivery: 'Assignment and delivery outcomes unknown; check before retrying.' } as AdminResult;
      return { email, outcome: 'assigned', status: data.invite.status,
        delivery: data.email?.notRequired ? 'Email not required' : data.email?.sent ? 'Invitation email sent' : 'Invitation email failed' } as AdminResult;
    },
    onSuccess: (result) => { setAdminResults([result]); setAddingGroup(null); setAddEmail(''); queryClient.invalidateQueries({ queryKey: ['admin-groups'] }); },
    onError: (error) => toast.error(getErrorMessage(error, 'Failed to add admin')),
  });

  const updateGroup = useMutation({
    mutationFn: async () => {
      if (!editingGroup) throw new Error('Group is required');

      const { data, error } = await supabase.rpc('admin_update_group', {
        _group_id: editingGroup.id,
        _name: form.name.trim(),
        _slug: normalizeSlug(form.slug),
        _description: form.description.trim() || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Department portal updated');
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      resetEditForm();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update department portal')),
  });

  const openEditDialog = (group: AdminGroupRow) => {
    setEditingGroup(group);
    setSlugTouched(true);
    setForm({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      initialAdminEmail: '',
    });
  };

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createGroup.mutate();
  };

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateGroup.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Department Portals
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the launch shell for Strasberg, Adler, and future school portals.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => (open ? setIsCreateOpen(true) : resetCreateForm())}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Department Portal</DialogTitle>
                <DialogDescription>
                  Add a department shell and assign its admins.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <GroupMetadataFields
                  form={form}
                  onNameChange={updateName}
                  onSlugChange={updateSlug}
                  onDescriptionChange={(description) => setForm((current) => ({ ...current, description }))}
                />
                <div className="space-y-2">
                  <Label htmlFor="initial-admin-email">Admin emails *</Label>
                  <Textarea
                    id="initial-admin-email"
                    value={form.initialAdminEmail}
                    onChange={(event) => setForm((current) => ({ ...current, initialAdminEmail: event.target.value }))}
                    placeholder="admin@school.edu, another@school.edu"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate addresses with commas or new lines.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={createGroup.isPending}>
                  {createGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Group
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading groups...
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {getErrorMessage(error, 'Could not load department portals.')}
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold">No department portals yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create Strasberg first, then reuse the same setup for Adler.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Group</th>
                    <th className="py-3 pr-4 font-medium">Slug</th>
                    <th className="py-3 pr-4 font-medium">Members</th>
                    <th className="py-3 pr-4 font-medium">Admins</th>
                    <th className="py-3 pr-4 font-medium">Created</th>
                    <th className="py-3 pr-4 font-medium">Updated</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGroups.map((group) => (
                    <tr key={group.id} className="border-b last:border-0">
                      <td className="py-4 pr-4">
                        <div className="font-medium">{group.name}</div>
                        <div className="mt-1 max-w-xs truncate text-muted-foreground">
                          {group.description || 'No description yet'}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <Badge variant="secondary">/{group.slug}</Badge>
                      </td>
                      <td className="py-4 pr-4">{group.active_member_count}</td>
                      <td className="py-4 pr-4">{group.active_admin_count}</td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {formatDistanceToNow(new Date(group.updated_at), { addSuffix: true })}
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(group)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setAddingGroup(group)}>Add admin</Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/groups/${group.slug}`} aria-label={`Open ${group.name}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {adminResults.length > 0 && <Card><CardHeader><CardTitle>Admin results</CardTitle></CardHeader><CardContent>
        <ul>{adminResults.map((result, index) => <li key={`${result.email}-${index}`}>
          {result.email || '(empty)'}: {result.outcome === 'assigned' ? `Assignment ${result.status}` : result.outcome}
          {result.error ? ` — ${result.error}` : ''}{result.delivery ? ` — ${result.delivery}` : ''}
        </li>)}</ul>
      </CardContent></Card>}

      <Dialog open={!!addingGroup} onOpenChange={(open) => { if (!open) setAddingGroup(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Add admin to {addingGroup?.name}</DialogTitle>
          <DialogDescription>Enter the email address of the person you want to add as a department admin.</DialogDescription>
        </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); addAdmin.mutate(); }}>
            <Label htmlFor="add-admin-email">Admin email</Label>
            <Input id="add-admin-email" type="email" value={addEmail} onChange={(event) => setAddEmail(event.target.value)} required />
            <Button type="submit" disabled={addAdmin.isPending}>Add admin</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroup} onOpenChange={(open) => { if (!open) resetEditForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Department Portal</DialogTitle>
            <DialogDescription>
              Update the public launch details for this department portal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <GroupMetadataFields
              form={form}
              onNameChange={updateName}
              onSlugChange={updateSlug}
              onDescriptionChange={(description) => setForm((current) => ({ ...current, description }))}
            />
            <Button type="submit" className="w-full" disabled={updateGroup.isPending}>
              {updateGroup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const GroupMetadataFields = ({
  form,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
}: {
  form: GroupFormState;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onDescriptionChange: (description: string) => void;
}) => (
  <>
    <div className="space-y-2">
      <Label htmlFor="group-name">Name *</Label>
      <Input
        id="group-name"
        value={form.name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Stella Adler Studio"
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="group-slug">Slug *</Label>
      <Input
        id="group-slug"
        value={form.slug}
        onChange={(event) => onSlugChange(event.target.value)}
        placeholder="stella-adler"
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        required
      />
      <p className="text-xs text-muted-foreground">Creates the public URL at /groups/{form.slug || 'slug'}.</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="group-description">Description</Label>
      <Textarea
        id="group-description"
        value={form.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="A private space for the department cohort and faculty."
        rows={3}
      />
    </div>
  </>
);

export default AdminGroupsManager;
