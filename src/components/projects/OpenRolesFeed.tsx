import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Users, Calendar, Send, Check, Clock, X, Upload, Video, FileText, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { useSavedItems } from '@/hooks/useSavedItems';
import { format, addMonths, isPast } from 'date-fns';
import { toast } from 'sonner';
import { VisitorAuthPrompt } from '@/components/auth/VisitorAuthPrompt';
import { OpportunityView } from '@/hooks/useOpportunities';
import ApplicationDialog from '@/components/opportunities/ApplicationDialog';
import OpportunityDetailSheet from '@/components/opportunities/OpportunityDetailSheet';
import { AuthRestoreState, clearAuthRestore, readAuthRestore } from '@/lib/authRestore';

interface OpenRole {
  roleId: string;
  roleName: string;
  projectId: string;
  projectTitle: string;
  projectDeadline: string | null;
  createdAt: string;
}

export const OpenRolesFeed: React.FC<{
  prependOpportunities?: OpportunityView[];
  restoreOpportunities?: OpportunityView[];
}> = ({ prependOpportunities = [], restoreOpportunities = prependOpportunities }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSaved, toggleSave } = useSavedItems();
  const hasPrependedItems = prependOpportunities.length > 0;

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [opportunityApplicationOpen, setOpportunityApplicationOpen] = useState(false);
  const [opportunityDetailOpen, setOpportunityDetailOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OpenRole | null>(null);
  const [selectedDetailOpportunity, setSelectedDetailOpportunity] = useState<OpportunityView | null>(null);
  const [selectedApplicationOpportunity, setSelectedApplicationOpportunity] = useState<OpportunityView | null>(null);
  const restoredOpportunityIdRef = useRef<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<{ name: string; url: string } | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [includeProfile, setIncludeProfile] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; headline: string | null; role: string | null } | null>(null);
  const [showVisitorAuthPrompt, setShowVisitorAuthPrompt] = useState(false);

  const updateJobSearchParam = (jobId?: string) => {
    const params = new URLSearchParams(location.search);
    if (jobId) {
      params.set('job', jobId);
    } else {
      params.delete('job');
    }

    const nextSearch = params.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`, {
      replace: true,
      state: location.state,
    });
  };

  useEffect(() => {
    const routeState = location.state as { restore?: AuthRestoreState } | null;
    const storedRestore = routeState?.restore || readAuthRestore();
    const jobId = storedRestore?.type === 'opportunity'
      ? storedRestore.id
      : new URLSearchParams(location.search).get('job');
    if (!jobId) return;
    if (restoredOpportunityIdRef.current === jobId) return;

    const restoredOpportunity = restoreOpportunities.find((opportunity) => opportunity.id === jobId);
    if (!restoredOpportunity) return;

    restoredOpportunityIdRef.current = jobId;
    setSelectedDetailOpportunity(restoredOpportunity);
    setOpportunityDetailOpen(true);
    clearAuthRestore();
    const nextRouteState = { ...(routeState || {}) };
    delete nextRouteState.restore;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: Object.keys(nextRouteState).length > 0 ? nextRouteState : undefined,
    });
  }, [restoreOpportunities, location, navigate]);

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

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['open-roles-feed'],
    queryFn: async () => {
      const { data: openRoles, error } = await supabase
        .from('project_roles')
        .select('id, role_name, project_id, created_at')
        .is('assigned_user_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!openRoles?.length) return [];

      const projectIds = [...new Set(openRoles.map(r => r.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, end_date')
        .eq('is_public', true)
        .in('id', projectIds);

      if (!projects?.length) return [];

      const projectMap = new Map(projects.map(p => [p.id, p]));

      return openRoles
        .filter(r => projectMap.has(r.project_id))
        .map(r => {
          const project = projectMap.get(r.project_id)!;
          return {
            roleId: r.id,
            roleName: r.role_name,
            projectId: r.project_id,
            projectTitle: project.title,
            projectDeadline: project.end_date,
            createdAt: r.created_at,
          } as OpenRole;
        });
    },
  });

  // Fetch user's existing applications
  const { data: myApplications = [] } = useQuery({
    queryKey: ['my-role-applications-feed', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const roleIds = roles.map(r => r.roleId);
      if (!roleIds.length) return [];
      const { data, error } = await supabase
        .from('role_applications')
        .select('project_role_id, status')
        .eq('applicant_id', user.id)
        .in('project_role_id', roleIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && roles.length > 0,
  });

  const submitApplication = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedRole) throw new Error('Invalid state');
      const { error } = await supabase
        .from('role_applications')
        .insert({
          project_role_id: selectedRole.roleId,
          applicant_id: user.id,
          message: applicationMessage.trim(),
          reel_url: reelUrl.trim() || null,
          resume_url: resumeFile?.url || null,
          include_profile: includeProfile,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-role-applications-feed'] });
      queryClient.invalidateQueries({ queryKey: ['my-role-job-applications'] });
      toast.success('Application submitted!');
      setApplyDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit application');
    },
  });

  const resetForm = () => {
    setApplicationMessage('');
    setReelUrl('');
    setResumeFile(null);
    setIncludeProfile(true);
    setSelectedRole(null);
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
      const fileName = `${user.id}/applications/${selectedRole?.roleId || 'general'}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file);
      if (uploadError) { toast.error('Failed to upload resume'); return; }
      const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
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

  const openApplicationDialog = (role: OpenRole, applicationStatus?: string) => {
    if (applicationStatus) return;
    if (!user) {
      setSelectedRole(role);
      setShowVisitorAuthPrompt(true);
      return;
    }
    setSelectedRole(role);
    setApplyDialogOpen(true);
  };

  const getOpportunityApplyLabel = (opportunity: OpportunityView) => {
    const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : null;
    if (!deadlineDate || isNaN(deadlineDate.getTime())) {
      return 'Deadline TBD';
    }
    return isPast(deadlineDate)
      ? 'Deadline passed'
      : `Apply by ${format(deadlineDate, 'MMM d, yyyy')}`;
  };

  const openOpportunity = (opportunity: OpportunityView) => {
    restoredOpportunityIdRef.current = opportunity.id;
    setSelectedDetailOpportunity(opportunity);
    setOpportunityDetailOpen(true);
    updateJobSearchParam(opportunity.id);
  };

  const openSelectedOpportunityApplication = () => {
    if (!selectedDetailOpportunity) return;
    if (!user) {
      setShowVisitorAuthPrompt(true);
      return;
    }

    setSelectedApplicationOpportunity(selectedDetailOpportunity);
    setOpportunityDetailOpen(false);
    setOpportunityApplicationOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0"><Clock className="w-3 h-3" />Pending</Badge>;
      case 'accepted':
        return <Badge className="gap-1 bg-green-500 text-[10px] px-1.5 py-0"><Check className="w-3 h-3" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0"><X className="w-3 h-3" />Declined</Badge>;
      default:
        return null;
    }
  };

  if (isLoading && !hasPrependedItems) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roles.length === 0 && !hasPrependedItems) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No open roles right now</p>
        <p className="text-sm text-muted-foreground mt-1">Check back later for opportunities</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {prependOpportunities.map((opportunity) => (
            <div
              key={opportunity.id}
              className="flex min-h-[112px] cursor-pointer flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              onClick={() => openOpportunity(opportunity)}
            >
              <div className="space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                  {opportunity.title}
                </h3>
                {opportunity.company && (
                  <p className="truncate text-xs text-muted-foreground">
                    {opportunity.company}
                  </p>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{getOpportunityApplyLabel(opportunity)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave({
                          item_type: 'job',
                          item_id: opportunity.id,
                          item_title: opportunity.title,
                          item_url: opportunity.linkUrl || opportunity.id,
                          item_metadata: {
                            company: opportunity.company,
                            type: opportunity.type,
                            location: opportunity.isRemote ? 'Remote' : opportunity.location,
                            description: opportunity.description?.slice(0, 200),
                            deadline: opportunity.deadline,
                            source: opportunity.source,
                          },
                        });
                      }}
                      className="rounded-full p-1 transition-colors hover:bg-accent"
                    >
                      {isSaved('job', opportunity.title, opportunity.linkUrl || opportunity.id) ? (
                        <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  {opportunity.actionType === 'external' && opportunity.linkUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOpportunity(opportunity);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ) : (
                    user && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOpportunity(opportunity);
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center justify-center p-4 rounded-lg border border-border bg-card">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {roles.map(role => {
            const deadlineDate = role.projectDeadline ? new Date(role.projectDeadline) : null;
            const applyBy = deadlineDate && !isNaN(deadlineDate.getTime())
              ? deadlineDate
              : addMonths(new Date(role.createdAt || Date.now()), 1);
            const applicationStatus = getApplicationStatus(role.roleId);

            return (
              <div
                key={role.roleId}
                className="flex flex-col justify-between gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => openApplicationDialog(role, applicationStatus)}
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {role.roleName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {role.projectTitle}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>Apply by {format(applyBy, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {user && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave({
                            item_type: 'open_role',
                            item_id: role.roleId,
                            item_title: role.roleName,
                            item_url: role.roleId,
                            item_metadata: {
                              projectTitle: role.projectTitle,
                              projectId: role.projectId,
                              deadline: role.projectDeadline,
                            },
                          });
                        }}
                        className="p-1 rounded-full hover:bg-accent transition-colors"
                      >
                        {isSaved('open_role', role.roleName, role.roleId) ? (
                          <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    {user && (
                      applicationStatus ? (
                        getStatusBadge(applicationStatus)
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openApplicationDialog(role, applicationStatus);
                          }}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showVisitorAuthPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-background/45 px-4 py-8 backdrop-blur-md sm:px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 rounded-full bg-card/90 text-foreground shadow-lg hover:bg-card"
            onClick={() => {
              setShowVisitorAuthPrompt(false);
              setSelectedRole(null);
            }}
            aria-label="Close sign in prompt"
          >
            <X className="h-4 w-4" />
          </Button>
          <VisitorAuthPrompt
            compact
            title="Apply on Inlight"
            description="Sign in or create an account to apply."
            features={['Internal application', 'Creator profile', 'Application tracking']}
            restore={
              selectedDetailOpportunity
                ? { type: 'opportunity', id: selectedDetailOpportunity.id }
                : undefined
            }
          />
        </div>
      )}

      {/* Apply Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={(open) => { setApplyDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for {selectedRole?.roleName}</DialogTitle>
            <DialogDescription>
              on {selectedRole?.projectTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Profile Preview */}
            {includeProfile && profile && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{profile.display_name || 'You'}</p>
                  <p className="text-xs text-muted-foreground">{profile.headline || profile.role || ''}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-profile"
                checked={includeProfile}
                onCheckedChange={(c) => setIncludeProfile(!!c)}
              />
              <Label htmlFor="include-profile" className="text-sm">Include my profile</Label>
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Why are you a great fit for this role?"
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Video className="w-4 h-4" /> Reel / Portfolio URL</Label>
              <Input
                placeholder="https://..."
                value={reelUrl}
                onChange={(e) => setReelUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><FileText className="w-4 h-4" /> Resume</Label>
              {resumeFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="truncate">{resumeFile.name}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setResumeFile(null)}>Remove</Button>
                </div>
              ) : (
                <div>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" id="resume-upload-feed" onChange={handleResumeUpload} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => document.getElementById('resume-upload-feed')?.click()}
                    disabled={isUploadingResume}
                  >
                    {isUploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload Resume
                  </Button>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!applicationMessage.trim() || submitApplication.isPending}
              onClick={() => submitApplication.mutate()}
            >
              {submitApplication.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ApplicationDialog
        open={opportunityApplicationOpen}
        onOpenChange={(open) => {
          setOpportunityApplicationOpen(open);
          if (!open) setSelectedApplicationOpportunity(null);
        }}
        opportunityId={selectedApplicationOpportunity?.id || ''}
        opportunityTitle={selectedApplicationOpportunity?.title || 'Opportunity'}
        onApplicationSubmitted={() => {
          setOpportunityApplicationOpen(false);
          setSelectedApplicationOpportunity(null);
        }}
      />

      <OpportunityDetailSheet
        opportunity={selectedDetailOpportunity}
        open={opportunityDetailOpen}
        onOpenChange={(open) => {
          setOpportunityDetailOpen(open);
          if (!open) {
            setSelectedDetailOpportunity(null);
            restoredOpportunityIdRef.current = null;
            updateJobSearchParam();
          }
        }}
        posterProfile={null}
        hasApplied={false}
        onApply={openSelectedOpportunityApplication}
      />
    </>
  );
};
