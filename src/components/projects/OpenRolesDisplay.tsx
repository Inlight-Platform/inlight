import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Link2, FileText, Loader2, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface OpenRole {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  project_id: string;
}

interface RoleApplication {
  id: string;
  project_role_id: string;
  applicant_id: string;
  message: string;
  reel_url: string | null;
  resume_url: string | null;
  status: string;
  created_at: string;
  applicant_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface OpenRolesDisplayProps {
  projectId: string;
  creatorId: string;
}

export const OpenRolesDisplay: React.FC<OpenRolesDisplayProps> = ({ projectId, creatorId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OpenRole | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');

  const isCreator = user?.id === creatorId;

  // Fetch open roles (unassigned)
  const { data: openRoles = [] } = useQuery({
    queryKey: ['open-roles', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId)
        .is('assigned_user_id', null);

      if (error) throw error;
      return data as OpenRole[];
    },
  });

  // Fetch user's existing applications
  const { data: myApplications = [] } = useQuery({
    queryKey: ['my-applications', projectId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('role_applications')
        .select('project_role_id, status')
        .eq('applicant_id', user.id)
        .in('project_role_id', openRoles.map(r => r.id));

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && openRoles.length > 0,
  });

  // Fetch all applications for creator
  const { data: allApplications = [] } = useQuery({
    queryKey: ['role-applications', projectId],
    queryFn: async () => {
      if (!isCreator) return [];
      const roleIds = openRoles.map(r => r.id);
      if (roleIds.length === 0) return [];

      const { data, error } = await supabase
        .from('role_applications')
        .select('*')
        .in('project_role_id', roleIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch applicant profiles
      const applicantIds = [...new Set(data.map(a => a.applicant_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', applicantIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(app => ({
        ...app,
        applicant_profile: profileMap.get(app.applicant_id),
      })) as RoleApplication[];
    },
    enabled: isCreator && openRoles.length > 0,
  });

  // Submit application
  const submitApplication = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedRole) throw new Error('Invalid state');

      const { error } = await supabase
        .from('role_applications')
        .insert({
          project_role_id: selectedRole.id,
          applicant_id: user.id,
          message: applicationMessage.trim(),
          reel_url: reelUrl.trim() || null,
          resume_url: resumeUrl.trim() || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-applications', projectId] });
      toast.success('Application submitted!');
      setApplyDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit application');
    },
  });

  // Update application status (for creator)
  const updateApplicationStatus = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const { error } = await supabase
        .from('role_applications')
        .update({ status })
        .eq('id', applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-applications', projectId] });
      toast.success('Application updated');
    },
  });

  const resetForm = () => {
    setApplicationMessage('');
    setReelUrl('');
    setResumeUrl('');
    setSelectedRole(null);
  };

  const getApplicationStatus = (roleId: string) => {
    return myApplications.find(a => a.project_role_id === roleId)?.status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case 'accepted':
        return <Badge className="gap-1 bg-green-500"><Check className="w-3 h-3" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><X className="w-3 h-3" />Declined</Badge>;
      default:
        return null;
    }
  };

  if (openRoles.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Open Roles</h3>
        {isCreator && allApplications.length > 0 && (
          <Badge variant="outline">{allApplications.length} applications</Badge>
        )}
      </div>

      <div className="grid gap-3">
        {openRoles.map((role) => {
          const applicationStatus = getApplicationStatus(role.id);
          const roleApplications = allApplications.filter(a => a.project_role_id === role.id);

          return (
            <div
              key={role.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{role.role_name}</p>
                  <p className="text-sm text-muted-foreground">Looking for candidates</p>
                </div>
                
                {!isCreator && user && (
                  applicationStatus ? (
                    getStatusBadge(applicationStatus)
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedRole(role);
                        setApplyDialogOpen(true);
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  )
                )}
              </div>

              {/* Show applications to creator */}
              {isCreator && roleApplications.length > 0 && (
                <div className="mt-4 space-y-3 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground">
                    {roleApplications.length} application{roleApplications.length !== 1 ? 's' : ''}
                  </p>
                  {roleApplications.map((app) => (
                    <div key={app.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={app.applicant_profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {app.applicant_profile?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">
                            {app.applicant_profile?.display_name || 'Unknown'}
                          </span>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{app.message}</p>
                      
                      <div className="flex gap-2 flex-wrap">
                        {app.reel_url && (
                          <a
                            href={app.reel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" /> Reel
                          </a>
                        )}
                        {app.resume_url && (
                          <a
                            href={app.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> Resume
                          </a>
                        )}
                      </div>

                      {app.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => updateApplicationStatus.mutate({ applicationId: app.id, status: 'accepted' })}
                          >
                            <Check className="w-4 h-4 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateApplicationStatus.mutate({ applicationId: app.id, status: 'rejected' })}
                          >
                            <X className="w-4 h-4 mr-1" /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Application Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Apply for {selectedRole?.role_name}</DialogTitle>
            <DialogDescription>
              Submit your application with a message and optional links to your work.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Tell the project creator why you're a great fit for this role..."
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reel">Reel/Portfolio URL (optional)</Label>
              <Input
                id="reel"
                type="url"
                placeholder="https://vimeo.com/..."
                value={reelUrl}
                onChange={(e) => setReelUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resume">Resume URL (optional)</Label>
              <Input
                id="resume"
                type="url"
                placeholder="https://drive.google.com/..."
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => submitApplication.mutate()}
              disabled={!applicationMessage.trim() || submitApplication.isPending}
            >
              {submitApplication.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OpenRolesDisplay;
