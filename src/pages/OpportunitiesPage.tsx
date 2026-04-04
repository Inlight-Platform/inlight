import React, { useState, useMemo } from 'react';
import { format, addMonths, isPast } from 'date-fns';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Plus, Briefcase, TrendingUp, Clock, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import OpportunityFilters from '@/components/opportunities/OpportunityFilters';
import OpportunityCreator from '@/components/opportunities/OpportunityCreator';
import OpportunityDetailSheet from '@/components/opportunities/OpportunityDetailSheet';
import ApplicationDialog from '@/components/opportunities/ApplicationDialog';
import { useOpportunities, OpportunityView } from '@/hooks/useOpportunities';
import { useAuth } from '@/hooks/useAuth';
import { OpenRolesFeed } from '@/components/projects/OpenRolesFeed';

/** Compact card matching the Open Roles style — title, company, deadline */
const OpportunityCompactCard: React.FC<{ opportunity: OpportunityView }> = ({ opportunity }) => {
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : null;
  const applyBy = deadlineDate && !isNaN(deadlineDate.getTime())
    ? deadlineDate
    : addMonths(new Date(opportunity.createdAt), 1);

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="flex flex-col justify-between gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
      >
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-sm leading-tight">
            {opportunity.roles?.[0] || opportunity.title}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {opportunity.company || opportunity.title}
          </p>
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
    </>
  );
};

type OpportunityType = 'job' | 'casting' | 'gig' | 'collaboration';
type UserRole = 'Actor' | 'Director' | 'Producer' | 'Musician';
type ExperienceLevel = 'entry' | 'intermediate' | 'senior' | 'any';

const OpportunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'info@inlight.social';
  const { opportunities: allOpportunities, isLoading } = useOpportunities();
  
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<OpportunityType | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | 'all'>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeTab, setActiveTab] = useState('discover');

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
            <img
              src={inlightLogo}
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h1 className="text-2xl font-display font-bold">Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {openOpportunities.length} open jobs
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button 
              onClick={() => setShowCreator(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Opportunity
            </Button>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 bg-card border border-border">
              <TabsTrigger value="discover" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                <TrendingUp className="w-4 h-4 mr-2" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="posted" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                <span className="hidden sm:inline">My </span>Posts ({myOpportunities.length})
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
          <TabsContent value="discover" className="space-y-8">
            {/* Posted Opportunities — compact cards matching Open Roles style */}
            {openOpportunities.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">All Opportunities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {openOpportunities.map((opportunity) => (
                    <OpportunityCompactCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              </div>
            )}

            {/* Open Project Roles */}
            <OpenRolesFeed />

            {openOpportunities.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or check back later
                </p>
                 {isAdmin && (
                   <Button onClick={() => setShowCreator(true)}>
                     Post an Opportunity
                   </Button>
                 )}
              </div>
            )}
          </TabsContent>

          {/* Posted Tab */}
          <TabsContent value="posted" className="space-y-4">
            {myOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {myOpportunities.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Plus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No opportunities posted</h3>
                <p className="text-muted-foreground mb-4">
                  Share opportunities with the creative community
                </p>
                 {isAdmin && (
                   <Button onClick={() => setShowCreator(true)}>
                     Post Your First Opportunity
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
        </Tabs>
      </div>

      {/* Opportunity Creator Modal */}
      <OpportunityCreator open={showCreator} onOpenChange={setShowCreator} />
    </div>
  );
};

export default OpportunitiesPage;
