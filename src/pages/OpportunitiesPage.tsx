import React, { useState, useMemo, useEffect } from 'react';
import { format, addMonths, isPast } from 'date-fns';
import { Plus, Briefcase, TrendingUp, Clock, Loader2, Calendar, Trash2, Users, ExternalLink, FileText, ArrowLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import OpportunityFilters from '@/components/opportunities/OpportunityFilters';
import OpportunityCreator from '@/components/opportunities/OpportunityCreator';
import OpportunityDetailSheet from '@/components/opportunities/OpportunityDetailSheet';
import ApplicationDialog from '@/components/opportunities/ApplicationDialog';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useOpportunities, OpportunityView } from '@/hooks/useOpportunities';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { OpenRolesFeed } from '@/components/projects/OpenRolesFeed';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STRIPE_POST_JOB_URL = 'https://buy.stripe.com/dRmaEWa8gaA3eVL3ufco002';

interface PostedJobApplication {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  applicantId: string;
  applicantName: string;
  applicantHeadline: string;
  message: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  additionalMaterials: { name?: string; file_path?: string; bucket?: string; type?: string }[];
  status: string;
  appliedAt: string;
}

interface MyJobApplication {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  company?: string;
  status: string;
  message: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  appliedAt: string;
}

/** Compact card matching the Open Roles style — title, company, deadline */
const OpportunityCompactCard: React.FC<{
  opportunity: OpportunityView;
  hasApplied: boolean;
  applicationStatus?: string;
}> = ({ opportunity, hasApplied: hasAppliedPersisted, applicationStatus }) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { canManageJobs } = useFeatureAccess();
  const { deleteOpportunity } = useOpportunities();
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hasAppliedLocally, setHasAppliedLocally] = useState(false);

  const canDelete = canManageJobs && !!user && (user.id === opportunity.postedBy || isAdmin);
  const hasApplied = hasAppliedPersisted || hasAppliedLocally;

  const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : null;
  const applyBy = deadlineDate && !isNaN(deadlineDate.getTime())
    ? deadlineDate
    : addMonths(new Date(opportunity.createdAt), 1);

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="relative flex flex-col justify-between gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
      >
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/20 transition-colors"
            title="Delete opportunity"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        )}
        <div className="space-y-1 pr-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm leading-tight">
              {opportunity.title}
            </h3>
            {hasApplied && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {applicationStatus === 'accepted' ? 'Accepted' :
                 applicationStatus === 'reviewed' ? 'Under Review' :
                 applicationStatus === 'rejected' ? 'Not Selected' : 'Applied'}
              </Badge>
            )}
          </div>
          {opportunity.roles?.[0] && (
            <p className="text-xs text-muted-foreground truncate">
              {opportunity.roles[0]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span>
            {isPast(applyBy) ? 'Deadline passed' : `Apply by ${format(applyBy, 'MMM d, yyyy')}`}
          </span>
        </div>
      </div>

      <OpportunityDetailSheet
        opportunity={opportunity}
        open={showDetail}
        onOpenChange={setShowDetail}
        posterProfile={null}
        hasApplied={hasApplied}
        applicationStatus={applicationStatus}
        onApply={() => { setShowDetail(false); setShowApply(true); }}
      />

      <ApplicationDialog
        open={showApply}
        onOpenChange={setShowApply}
        opportunityId={opportunity.id}
        opportunityTitle={opportunity.title}
        onApplicationSubmitted={() => setHasAppliedLocally(true)}
      />

      <DeleteConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={() => deleteOpportunity.mutate(opportunity.id)}
        title="Delete Opportunity"
        description="Are you sure you want to delete this opportunity? This action cannot be undone."
        isPending={deleteOpportunity.isPending}
      />
    </>
  );
};

const PostedJobApplications: React.FC<{
  postedJobs: OpportunityView[];
  applications: PostedJobApplication[];
  isLoading: boolean;
}> = ({ postedJobs, applications, isLoading }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (postedJobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No posted jobs yet</h3>
        <p className="text-muted-foreground">
          Jobs you post will appear here with their applications.
        </p>
      </div>
    );
  }

  const applicationsByJob = new Map<string, PostedJobApplication[]>();
  applications.forEach((application) => {
    const jobApplications = applicationsByJob.get(application.opportunityId) || [];
    jobApplications.push(application);
    applicationsByJob.set(application.opportunityId, jobApplications);
  });

  const selectedJob = postedJobs.find((job) => job.id === selectedJobId) || null;
  const selectedApplications = selectedJob ? applicationsByJob.get(selectedJob.id) || [] : [];

  if (!selectedJob) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Applications by posted job</h2>
          <p className="text-sm text-muted-foreground">
            Select a job you posted to review the applications submitted for that specific listing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {postedJobs.map((job) => {
            const jobApplications = applicationsByJob.get(job.id) || [];
            const deadlineDate = job.deadline ? new Date(job.deadline) : null;
            const applyBy = deadlineDate && !isNaN(deadlineDate.getTime())
              ? deadlineDate
              : addMonths(new Date(job.createdAt), 1);

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className="text-left rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-foreground text-sm leading-tight">
                      {job.title}
                    </h3>
                    {job.company && (
                      <p className="text-xs text-muted-foreground truncate">
                        {job.company}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant={jobApplications.length > 0 ? 'default' : 'secondary'}>
                    {jobApplications.length} {jobApplications.length === 1 ? 'application' : 'applications'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {isPast(applyBy) ? 'Deadline passed' : `Apply by ${format(applyBy, 'MMM d, yyyy')}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-1.5"
            onClick={() => setSelectedJobId(null)}
          >
            <ArrowLeft className="w-4 h-4" />
            Posted jobs
          </Button>
          <h2 className="text-lg font-semibold">{selectedJob.title}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedApplications.length} {selectedApplications.length === 1 ? 'application' : 'applications'} submitted for this job.
          </p>
        </div>
      </div>

      {selectedApplications.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
          <p className="text-muted-foreground">
            Applications for this job will appear here once people apply.
          </p>
        </div>
      ) : selectedApplications.map((application) => (
        <div
          key={application.id}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {application.applicantName}
                </h3>
                <Badge variant="outline" className="capitalize">
                  {application.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {application.applicantHeadline}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Applied to <span className="text-foreground">{application.opportunityTitle}</span> on {format(new Date(application.appliedAt), 'MMM d, yyyy')}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => window.open(`/profile/${application.applicantId}`, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="w-4 h-4" />
              Profile
            </Button>
          </div>

          {application.message && (
            <div className="rounded-md bg-muted/30 p-3">
              <p className="text-sm whitespace-pre-wrap">{application.message}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {application.resumeUrl && (
              <Button size="sm" variant="secondary" className="gap-1.5" asChild>
                <a href={application.resumeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Resume
                </a>
              </Button>
            )}
            {application.portfolioUrl && (
              <Button size="sm" variant="secondary" className="gap-1.5" asChild>
                <a href={application.portfolioUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Portfolio
                </a>
              </Button>
            )}
            {application.additionalMaterials.map((material, index) => (
              <Badge key={`${application.id}-${index}`} variant="outline" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {material.name || `Material ${index + 1}`}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const MyJobApplications: React.FC<{
  applications: MyJobApplication[];
  isLoading: boolean;
  onViewJob: (application: MyJobApplication) => void;
}> = ({ applications, isLoading, onViewJob }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No job applications yet</h3>
        <p className="text-muted-foreground">
          Jobs you apply to will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <div
          key={application.id}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {application.opportunityTitle}
                </h3>
                <Badge variant="outline" className="capitalize">
                  {application.status}
                </Badge>
              </div>
              {application.company && (
                <p className="text-sm text-muted-foreground">
                  {application.company}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Applied on {format(new Date(application.appliedAt), 'MMM d, yyyy')}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => onViewJob(application)}
            >
              <ExternalLink className="w-4 h-4" />
              View Job
            </Button>
          </div>

          {application.message && (
            <div className="rounded-md bg-muted/30 p-3">
              <p className="text-sm whitespace-pre-wrap">{application.message}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {application.resumeUrl && (
              <Button size="sm" variant="secondary" className="gap-1.5" asChild>
                <a href={application.resumeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Resume
                </a>
              </Button>
            )}
            {application.portfolioUrl && (
              <Button size="sm" variant="secondary" className="gap-1.5" asChild>
                <a href={application.portfolioUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Portfolio
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

type OpportunityType = 'job' | 'casting' | 'gig' | 'collaboration';
type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician' | 'Gaffer' | 'Grip' | 'DP' | 'AD' | 'Extras' | 'Singer' | 'Dancer' | 'Designer';
type ExperienceLevel = 'entry' | 'intermediate' | 'senior' | 'any';

const OpportunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { canManageJobs, showRestrictedToast } = useFeatureAccess();
  const { opportunities: allOpportunities, isLoading } = useOpportunities();
  
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<OpportunityType | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | 'all'>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeTab, setActiveTab] = useState('discover');
  const [credits, setCredits] = useState(0);

  // Load credits from the server. The Stripe webhook is the only thing that
  // can grant credits, so this is the source of truth.
  const refreshCredits = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('job_post_credits')
      .select('credits')
      .eq('user_id', user.id)
      .maybeSingle();
    setCredits(data?.credits ?? 0);
  };

  useEffect(() => {
    if (!user) return;
    refreshCredits();

    // Realtime: refresh when the webhook upserts credits for this user
    const channel = supabase
      .channel(`job-credits:${user.id}`, { config: { private: true } })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_post_credits',
          filter: `user_id=eq.${user.id}`,
        },
        () => refreshCredits()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handlePostJobClick = () => {
    if (!canManageJobs) {
      showRestrictedToast('jobs');
      return;
    }

    if (isAdmin || credits > 0) {
      setShowCreator(true);
    } else if (user) {
      // Pass the user id to Stripe via client_reference_id so the webhook
      // knows whose account to credit on payment success.
      const url = `${STRIPE_POST_JOB_URL}?client_reference_id=${encodeURIComponent(user.id)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.info('Complete payment in the new tab. Your posting credit will unlock automatically once Stripe confirms.');
    }
  };

  const handleCreatorOpenChange = (open: boolean) => {
    // When dialog closes after a successful post, the creator invalidates queries.
    // Detect a new opportunity by length increase via effect below; here just toggle.
    setShowCreator(open);
  };

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    allOpportunities.forEach(o => {
      if (o.location && !o.isRemote) {
        locs.add(o.location);
      }
    });
    return Array.from(locs).sort();
  }, [allOpportunities]);

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return allOpportunities.filter(o => {
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          o.title.toLowerCase().includes(searchLower) ||
          o.description.toLowerCase().includes(searchLower) ||
          o.company?.toLowerCase().includes(searchLower) ||
          o.tags.some(t => t.includes(searchLower));
        if (!matchesSearch) return false;
      }
      if (selectedType !== 'all' && o.type !== selectedType) return false;
      if (selectedRole !== 'all' && !o.roles.includes(selectedRole)) return false;
      if (selectedExperience !== 'all' && o.experienceLevel !== selectedExperience && o.experienceLevel !== 'any') return false;
      if (remoteOnly && !o.isRemote) return false;
      if (selectedLocation !== 'all' && o.location !== selectedLocation) return false;
      return true;
    });
  }, [allOpportunities, search, selectedType, selectedRole, selectedExperience, remoteOnly, selectedLocation]);

  const myOpportunities = useMemo(() => 
    allOpportunities.filter(o => user && o.postedBy === user.id),
    [allOpportunities, user]
  );

  const openOpportunities = useMemo(() => 
    filteredOpportunities
      .filter(o => o.status === 'open' && !(o.deadline && new Date(o.deadline) < new Date()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredOpportunities]
  );

  const expiredOpportunities = useMemo(() => 
    allOpportunities
      .filter(o => o.deadline && new Date(o.deadline) < new Date())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allOpportunities]
  );

  const postedOpportunityMap = useMemo(() => {
    if (!user) return new Map<string, OpportunityView>();
    return new Map(
      allOpportunities
        .filter((opportunity) => opportunity.source !== 'post' && opportunity.postedBy === user.id)
        .map((opportunity) => [opportunity.id, opportunity])
    );
  }, [allOpportunities, user]);

  const postedOpportunityIds = useMemo(
    () => Array.from(postedOpportunityMap.keys()),
    [postedOpportunityMap]
  );
  const postedOpportunities = useMemo(
    () => Array.from(postedOpportunityMap.values()),
    [postedOpportunityMap]
  );

  const { data: postedApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['posted-job-applications', user?.id, postedOpportunityIds],
    queryFn: async () => {
      if (!user?.id || postedOpportunityIds.length === 0) return [];

      const { data: applicationRows, error } = await supabase
        .from('opportunity_applications')
        .select('id, opportunity_id, applicant_id, message, resume_url, portfolio_url, additional_materials, include_profile, status, created_at')
        .in('opportunity_id', postedOpportunityIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!applicationRows?.length) return [];

      const applicantIds = [...new Set(applicationRows.map((application) => application.applicant_id))];
      const { data: profileRows } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, headline, role')
        .in('user_id', applicantIds);

      const profileMap = new Map((profileRows || []).map((profile) => [profile.user_id, profile]));

      return applicationRows.map((application) => {
        const profile = profileMap.get(application.applicant_id);
        const additionalMaterials = Array.isArray(application.additional_materials)
          ? (application.additional_materials as PostedJobApplication['additionalMaterials'])
          : [];

        return {
          id: application.id,
          opportunityId: application.opportunity_id,
          opportunityTitle: postedOpportunityMap.get(application.opportunity_id)?.title || 'Untitled job',
          applicantId: application.applicant_id,
          applicantName: profile?.display_name || 'Unknown applicant',
          applicantHeadline: profile?.headline || profile?.role || 'Inlight member',
          message: application.message,
          resumeUrl: application.resume_url,
          portfolioUrl: application.portfolio_url,
          additionalMaterials,
          status: application.status,
          appliedAt: application.created_at,
        } satisfies PostedJobApplication;
      });
    },
    enabled: !!user?.id && postedOpportunityIds.length > 0,
  });

  const opportunityMap = useMemo(
    () => new Map(allOpportunities.map((opportunity) => [opportunity.id, opportunity])),
    [allOpportunities]
  );

  const { data: myJobApplications = [], isLoading: myApplicationsLoading } = useQuery({
    queryKey: ['my-job-applications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: applicationRows, error } = await supabase
        .from('opportunity_applications')
        .select('id, opportunity_id, message, resume_url, portfolio_url, status, created_at')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (applicationRows || []).map((application) => {
        const opportunity = opportunityMap.get(application.opportunity_id);

        return {
          id: application.id,
          opportunityId: application.opportunity_id,
          opportunityTitle: opportunity?.title || 'Untitled job',
          company: opportunity?.company,
          status: application.status,
          message: application.message,
          resumeUrl: application.resume_url,
          portfolioUrl: application.portfolio_url,
          appliedAt: application.created_at,
        } satisfies MyJobApplication;
      });
    },
    enabled: !!user?.id,
  });

  const canReviewApplications = canManageJobs && !!user && (isAdmin || credits > 0 || postedOpportunityIds.length > 0 || postedApplications.length > 0);
  const canViewMyApplications = !!user && (myApplicationsLoading || myJobApplications.length > 0);
  const myApplicationStatusByOpportunity = useMemo(
    () => new Map(myJobApplications.map((application) => [application.opportunityId, application.status])),
    [myJobApplications]
  );

  const handleViewAppliedJob = (application: MyJobApplication) => {
    const opportunity = opportunityMap.get(application.opportunityId);
    setSearch(opportunity?.title || application.opportunityTitle);
    setSelectedType('all');
    setSelectedRole('all');
    setSelectedExperience('all');
    setRemoteOnly(false);
    setSelectedLocation('all');
    setActiveTab('discover');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold">Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {openOpportunities.length} open jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canReviewApplications && (
              <Button
                variant={activeTab === 'applications' ? 'default' : 'outline'}
                onClick={() => setActiveTab('applications')}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Applications
                {postedApplications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {postedApplications.length}
                  </Badge>
                )}
              </Button>
            )}
            {canManageJobs && (
              <Button
                onClick={handlePostJobClick}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post A Job
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-card border border-border">
              <TabsTrigger value="discover" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                <TrendingUp className="w-4 h-4 mr-2" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="expired" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                <Clock className="w-4 h-4 mr-2" />
                Expired ({expiredOpportunities.length})
              </TabsTrigger>
              {canViewMyApplications && (
                <TabsTrigger value="my-applications" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                  <Briefcase className="w-4 h-4 mr-2" />
                  My Applications ({myJobApplications.length})
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Filters */}
          {activeTab !== 'applications' && activeTab !== 'my-applications' && (
            <OpportunityFilters
              search={search}
              onSearchChange={setSearch}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              selectedExperience={selectedExperience}
              onExperienceChange={setSelectedExperience}
              remoteOnly={remoteOnly}
              onRemoteOnlyChange={setRemoteOnly}
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
            />
          )}

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-3">
            {/* Unified grid — posted opportunities + open roles */}
            <OpenRolesFeed
              prependItems={openOpportunities.map((opportunity) => (
                <OpportunityCompactCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  hasApplied={myApplicationStatusByOpportunity.has(opportunity.id)}
                  applicationStatus={myApplicationStatusByOpportunity.get(opportunity.id)}
                />
              ))}
            />

            {openOpportunities.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or check back later
                </p>
                 {canManageJobs && (
                   <Button onClick={handlePostJobClick}>
                     Post A Job
                   </Button>
                 )}
              </div>
            )}
          </TabsContent>

          {/* Expired Tab */}
          <TabsContent value="expired" className="space-y-4">
            {expiredOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {expiredOpportunities.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No expired opportunities</h3>
                <p className="text-muted-foreground">
                  Past-deadline opportunities will appear here
                </p>
              </div>
            )}
          </TabsContent>

          {canReviewApplications && (
            <TabsContent value="applications" className="space-y-4">
              <PostedJobApplications
                postedJobs={postedOpportunities}
                applications={postedApplications}
                isLoading={applicationsLoading}
              />
            </TabsContent>
          )}

          {canViewMyApplications && (
            <TabsContent value="my-applications" className="space-y-4">
              <MyJobApplications
                applications={myJobApplications}
                isLoading={myApplicationsLoading}
                onViewJob={handleViewAppliedJob}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Opportunity Creator Modal */}
      <OpportunityCreator open={showCreator} onOpenChange={handleCreatorOpenChange} />
    </div>
  );
};

export default OpportunitiesPage;
