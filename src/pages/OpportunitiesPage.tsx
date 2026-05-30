import React, { useState, useMemo, useEffect } from 'react';
import { format, addMonths, isPast } from 'date-fns';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Plus, Briefcase, TrendingUp, Clock, Loader2, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { OpenRolesFeed } from '@/components/projects/OpenRolesFeed';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STRIPE_POST_JOB_URL = 'https://buy.stripe.com/dRmaEWa8gaA3eVL3ufco002';

/** Compact card matching the Open Roles style — title, company, deadline */
const OpportunityCompactCard: React.FC<{ opportunity: OpportunityView }> = ({ opportunity }) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { deleteOpportunity } = useOpportunities();
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const canDelete = !!user && (user.id === opportunity.postedBy || isAdmin);

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
          <h3 className="font-semibold text-foreground text-sm leading-tight">
            {opportunity.title}
          </h3>
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
        onApply={() => { setShowDetail(false); setShowApply(true); }}
      />

      <ApplicationDialog
        open={showApply}
        onOpenChange={setShowApply}
        opportunityId={opportunity.id}
        opportunityTitle={opportunity.title}
        onApplicationSubmitted={() => setHasApplied(true)}
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

type OpportunityType = 'job' | 'casting' | 'gig' | 'collaboration';
type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician' | 'Gaffer' | 'Grip' | 'DP' | 'AD' | 'Extras' | 'Singer' | 'Dancer' | 'Designer';
type ExperienceLevel = 'entry' | 'intermediate' | 'senior' | 'any';

const OpportunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
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
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold">Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {openOpportunities.length} open jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePostJobClick}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post A Job
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
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
            </TabsList>
          </div>

          {/* Filters */}
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

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-3">
            {/* Unified grid — posted opportunities + open roles */}
            <OpenRolesFeed
              prependItems={openOpportunities.map((opportunity) => (
                <OpportunityCompactCard key={opportunity.id} opportunity={opportunity} />
              ))}
            />

            {openOpportunities.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or check back later
                </p>
                 <Button onClick={handlePostJobClick}>
                   Post A Job
                 </Button>
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
        </Tabs>
      </div>

      {/* Opportunity Creator Modal */}
      <OpportunityCreator open={showCreator} onOpenChange={handleCreatorOpenChange} />
    </div>
  );
};

export default OpportunitiesPage;
