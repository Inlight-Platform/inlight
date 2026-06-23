import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Link2, FileText, Loader2, Check, X, Clock, Trash2, User, Eye, Upload, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ApplicationDetailSheet } from './ApplicationDetailSheet';
import { AcceptApplicationDialog } from './AcceptApplicationDialog';

interface OpenRole {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  project_id: string;
}

interface RoleInvitation {
  project_role_id: string;
  receiver_id: string;
  status: string;
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
  onDeleteRole?: (roleId: string) => void;
}

export const OpenRolesDisplay: React.FC<OpenRolesDisplayProps> = ({ projectId, creatorId, onDeleteRole }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OpenRole | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<{ name: string; url: string } | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [includeProfile, setIncludeProfile] = useState(true);
  const [viewingApplication, setViewingApplication] = useState<(RoleApplication & { role_name?: string }) | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; headline: string | null; role: string | null } | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [pendingAccept, setPendingAccept] = useState<{ applicationId: string; applicantId: string; applicantName: string; roleName: string } | null>(null);

  // Fetch user profile for the preview card
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, headline, role')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile(data);
    };
    if (applyDialogOpen && user) fetchProfile();
  }, [applyDialogOpen, user]);

  const isCreator = user?.id === creatorId;

  // Fetch project title
  const { data: projectData } = useQuery({
    queryKey: ['project-title', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('title')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch project roles. Unassigned roles are open for applications; assigned
  // roles show who was invited/placed into that role.
  const { data: openRoles = [] } = useQuery({
    queryKey: ['open-roles', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as OpenRole[];
    },
  });

  const openApplicationRoles = openRoles.filter((role) => !role.assigned_user_id);

  const visibleAssignedUserIds = [...new Set(
    openRoles
      .map((role) => role.assigned_user_id)
      .filter((assignedUserId): assignedUserId is string => {
        if (!assignedUserId || !user?.id) return false;
        return isCreator || assignedUserId === user.id;
      })
  )];

  const { data: assignedProfiles = new Map<string, { display_name: string | null; avatar_url: string | null }>() } = useQuery({
    queryKey: ['project-role-assigned-profiles', projectId, visibleAssignedUserIds.join(',')],
    queryFn: async () => {
      if (visibleAssignedUserIds.length === 0) return new Map<string, { display_name: string | null; avatar_url: string | null }>();

      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', visibleAssignedUserIds);

      if (error) throw error;
      return new Map((data || []).map((profile) => [profile.user_id, {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }]));
    },
    enabled: visibleAssignedUserIds.length > 0,
  });

  const { data: roleInvitations = [] } = useQuery({
    queryKey: ['project-role-invitations', projectId, user?.id],
    queryFn: async () => {
      if (!user?.id || openRoles.length === 0) return [];

      const { data, error } = await supabase
        .from('project_invitations')
        .select('project_role_id, receiver_id, status')
        .in('project_role_id', openRoles.map((role) => role.id));

      if (error) throw error;
      return data as RoleInvitation[];
    },
    enabled: !!user?.id && openRoles.length > 0,
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
        .in('project_role_id', openApplicationRoles.map(r => r.id));

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && openApplicationRoles.length > 0,
  });

  // Fetch all applications for creator
  const { data: allApplications = [] } = useQuery({
    queryKey: ['role-applications', projectId],
    queryFn: async () => {
      if (!isCreator) return [];
      const roleIds = openApplicationRoles.map(r => r.id);
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
    enabled: isCreator && openApplicationRoles.length > 0,
  });

  // Auto-open application from URL param (e.g., from notification click)
  useEffect(() => {
    const applicationId = searchParams.get('application');
    if (applicationId && allApplications.length > 0) {
      const app = allApplications.find(a => a.id === applicationId);
      if (app) {
        const role = openRoles.find(r => r.id === app.project_role_id);
        setViewingApplication({ ...app, role_name: role?.role_name });
        searchParams.delete('application');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [allApplications, searchParams, openRoles]);

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
          resume_url: resumeFile?.url || null,
          include_profile: includeProfile,
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
    mutationFn: async ({ applicationId, status, applicantId, roleName }: { 
      applicationId: string; 
      status: string; 
      applicantId?: string;
      roleName?: string;
    }) => {
      const { error } = await supabase
        .from('role_applications')
        .update({ status })
        .eq('id', applicationId);

      if (error) throw error;

      // If accepted, add the applicant as a team member
      if (status === 'accepted' && applicantId) {
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: applicantId,
            role: roleName || null,
          });
        
        // Ignore duplicate member errors
        if (memberError && !memberError.message.includes('duplicate')) {
          console.error('Error adding team member:', memberError);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['role-applications', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success(variables.status === 'accepted' ? 'Application accepted! Team member added.' : 'Application updated');
    },
  });

  const resetForm = () => {
    setApplicationMessage('');
    setReelUrl('');
    setResumeUrl('');
    setResumeFile(null);
    setIncludeProfile(true);
    setSelectedRole(null);
  };

  const handleAcceptClick = (applicationId: string, applicantId: string, applicantName: string, roleName: string) => {
    setPendingAccept({ applicationId, applicantId, applicantName, roleName });
    setAcceptDialogOpen(true);
  };

  const handleAcceptConfirm = async (welcomeMessage: string) => {
    if (!pendingAccept || !user?.id) return;

    // Accept the application (adds to team, group chat, etc.)
    updateApplicationStatus.mutate(
      { applicationId: pendingAccept.applicationId, status: 'accepted', applicantId: pendingAccept.applicantId, roleName: pendingAccept.roleName },
      {
        onSuccess: async () => {
          // Send welcome DM if provided
          if (welcomeMessage.trim()) {
            await supabase.from('messages').insert({
              sender_id: user.id,
              receiver_id: pendingAccept.applicantId,
              content: welcomeMessage.trim(),
            });
          }

          setAcceptDialogOpen(false);
          setViewingApplication(null);
          setPendingAccept(null);
        },
      }
    );
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large. Max size is 10MB.');
      return;
    }

    setIsUploadingResume(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/applications/${selectedRole?.id || 'general'}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file);

      if (uploadError) {
        toast.error('Failed to upload resume');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      setResumeFile({ name: file.name, url: urlData.publicUrl });
      toast.success('Resume uploaded');
    } catch {
      toast.error('Failed to upload resume');
    } finally {
      setIsUploadingResume(false);
      e.target.value = '';
    }
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
          const assignedProfile = role.assigned_user_id ? assignedProfiles.get(role.assigned_user_id) : null;
          const roleInvitation = roleInvitations.find((invitation) => invitation.project_role_id === role.id);
          const canSeeAssignedDetails = isCreator || role.assigned_user_id === user?.id || roleInvitation?.receiver_id === user?.id;
          const canApplyToRole = !isCreator && user && !role.assigned_user_id;

          return (
            <div
              key={role.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{role.role_name}</p>
                  {role.assigned_user_id && canSeeAssignedDetails ? (
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={assignedProfile?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {assignedProfile?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        Invited: {assignedProfile?.display_name || 'User'}
                        {roleInvitation?.status && (
                          <span className="capitalize"> · {roleInvitation.status}</span>
                        )}
                      </span>
                    </div>
                  ) : role.assigned_user_id ? (
                    <p className="text-sm text-muted-foreground">
                      {roleInvitation?.status === 'accepted' && canSeeAssignedDetails ? 'Role filled' : 'Invitation pending'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Looking for candidates</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {isCreator && onDeleteRole && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDeleteRole(role.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {role.assigned_user_id && canSeeAssignedDetails && (
                    <Badge variant={roleInvitation?.status === 'accepted' ? 'default' : 'secondary'} className="capitalize">
                      {roleInvitation?.status || 'Invited'}
                    </Badge>
                  )}
                  {canApplyToRole && (
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
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/profile/${app.applicant_id}`)}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={app.applicant_profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {app.applicant_profile?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm hover:underline">
                            {app.applicant_profile?.display_name || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setViewingApplication({ ...app, role_name: role.role_name } as any)}
                          >
                            <Eye className="w-3 h-3" />
                            View Application
                          </Button>
                          {getStatusBadge(app.status)}
                        </div>
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
                            onClick={() => handleAcceptClick(
                              app.id,
                              app.applicant_id,
                              app.applicant_profile?.display_name || 'Unknown',
                              role.role_name
                            )}
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
            {/* Include Profile Section */}
            <Card className="p-4 bg-muted/30">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="include-profile"
                  checked={includeProfile}
                  onCheckedChange={(checked) => setIncludeProfile(checked as boolean)}
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="include-profile" 
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    Include your Inlight profile
                  </Label>
                  {profile && includeProfile && (
                    <div className="flex items-center gap-3 mt-3 p-3 bg-background rounded-lg border border-border">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {profile.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.display_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.headline || profile.role || 'Inlight Member'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/profile/${user?.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

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
              <Label htmlFor="reel" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Reel / Portfolio Link (optional)
              </Label>
              <Input
                id="reel"
                type="url"
                placeholder="YouTube, Vimeo, or Google Drive link"
                value={reelUrl}
                onChange={(e) => setReelUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Accepts YouTube, Vimeo, or Google Drive links</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resume (optional)
              </Label>
              {resumeFile ? (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{resumeFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => setResumeFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input
                    type="file"
                    id="resume-upload"
                    accept=".pdf,.doc,.docx"
                    onChange={handleResumeUpload}
                    className="hidden"
                    disabled={isUploadingResume}
                  />
                  <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    {isUploadingResume ? (
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {isUploadingResume ? 'Uploading...' : 'Upload resume (PDF, DOC)'}
                    </span>
                    <span className="text-xs text-muted-foreground">Max 10MB</span>
                  </label>
                </div>
              )}
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
      {/* Application Detail Sheet */}
      <ApplicationDetailSheet
        open={!!viewingApplication}
        onOpenChange={(open) => { if (!open) setViewingApplication(null); }}
        application={viewingApplication}
        isCreator={isCreator}
        onAccept={(applicationId, applicantId, roleName) => {
          const applicantName = viewingApplication?.applicant_profile?.display_name || 'Unknown';
          handleAcceptClick(applicationId, applicantId, applicantName, roleName);
        }}
        onDecline={(applicationId) => {
          updateApplicationStatus.mutate({ applicationId, status: 'rejected' });
          setViewingApplication(null);
        }}
      />

      {/* Accept Confirmation Dialog */}
      <AcceptApplicationDialog
        open={acceptDialogOpen}
        onOpenChange={(open) => {
          setAcceptDialogOpen(open);
          if (!open) setPendingAccept(null);
        }}
        applicantName={pendingAccept?.applicantName || ''}
        roleName={pendingAccept?.roleName || ''}
        projectName={projectData?.title || ''}
        isPending={updateApplicationStatus.isPending}
        onConfirm={handleAcceptConfirm}
      />
    </div>
  );
};

export default OpenRolesDisplay;
