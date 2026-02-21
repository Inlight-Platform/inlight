import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Star, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore, OpportunityType, ExperienceLevel, UserRole, Opportunity } from '@/store/useStore';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import OpportunityFilters from '@/components/opportunities/OpportunityFilters';
import OpportunityCreator from '@/components/opportunities/OpportunityCreator';
import { stubOpportunities } from '@/data/stubData';

const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUserId, getOpportunities, opportunities, getUser } = useStore();
  const currentUser = getUser(currentUserId);
  
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<OpportunityType | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | 'all'>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeTab, setActiveTab] = useState('discover');

  // Initialize opportunities from stub data if empty
  useEffect(() => {
    if (opportunities.length === 0) {
      useStore.setState({ opportunities: stubOpportunities });
    }
  }, [opportunities.length]);

  const allOpportunities = getOpportunities();

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
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          o.title.toLowerCase().includes(searchLower) ||
          o.description.toLowerCase().includes(searchLower) ||
          o.company?.toLowerCase().includes(searchLower) ||
          o.tags.some(t => t.includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Type filter
      if (selectedType !== 'all' && o.type !== selectedType) return false;

      // Role filter
      if (selectedRole !== 'all' && !o.roles.includes(selectedRole)) return false;

      // Experience filter
      if (selectedExperience !== 'all' && o.experienceLevel !== selectedExperience && o.experienceLevel !== 'any') return false;

      // Remote filter
      if (remoteOnly && !o.isRemote) return false;

      // Location filter
      if (selectedLocation !== 'all' && o.location !== selectedLocation) return false;

      return true;
    });
  }, [allOpportunities, search, selectedType, selectedRole, selectedExperience, remoteOnly, selectedLocation]);

  // Get opportunities by category
  const featuredOpportunities = useMemo(() => 
    filteredOpportunities.filter(o => o.isFeatured && o.status === 'open'),
    [filteredOpportunities]
  );

  const myOpportunities = useMemo(() => 
    allOpportunities.filter(o => o.postedBy === currentUserId),
    [allOpportunities, currentUserId]
  );

  const appliedOpportunities = useMemo(() => 
    allOpportunities.filter(o => o.applicants.some(a => a.userId === currentUserId)),
    [allOpportunities, currentUserId]
  );

  const matchingOpportunities = useMemo(() => {
    if (!currentUser) return [];
    return filteredOpportunities.filter(o => 
      o.status === 'open' && o.roles.includes(currentUser.role)
    );
  }, [filteredOpportunities, currentUser]);

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

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, hsl(147 100% 50%), hsl(160 100% 45%))',
                boxShadow: '0 0 20px hsl(147 100% 50% / 0.4)'
              }}
            >
              <Briefcase className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {openOpportunities.length} open jobs
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCreator(true)}
            className="bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post Opportunity
          </Button>
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
              <TabsTrigger value="matching" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                <Star className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">For You </span>({matchingOpportunities.length})
              </TabsTrigger>
              <TabsTrigger value="applied" className="data-[state=active]:bg-[hsl(var(--neon-opportunities))]/20 whitespace-nowrap">
                Applied ({appliedOpportunities.length})
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
          <TabsContent value="discover" className="space-y-6">
            {/* All Open Opportunities */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">All Opportunities</h2>
              {openOpportunities.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {openOpportunities.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters or check back later
                  </p>
                  <Button onClick={() => setShowCreator(true)}>
                    Post an Opportunity
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Matching Tab */}
          <TabsContent value="matching" className="space-y-4">
            <p className="text-muted-foreground">
              Opportunities matching your role as <span className="font-medium text-foreground">{currentUser?.role}</span>
            </p>
            {matchingOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {matchingOpportunities.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No matching opportunities</h3>
                <p className="text-muted-foreground">
                  We'll notify you when opportunities for {currentUser?.role}s are posted
                </p>
              </div>
            )}
          </TabsContent>

          {/* Applied Tab */}
          <TabsContent value="applied" className="space-y-4">
            {appliedOpportunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {appliedOpportunities.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start applying to opportunities to track them here
                </p>
                <Button onClick={() => setActiveTab('discover')}>
                  Browse Opportunities
                </Button>
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
                <Button onClick={() => setShowCreator(true)}>
                  Post Your First Opportunity
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
      <OpportunityCreator open={showCreator} onOpenChange={setShowCreator} />
    </div>
  );
};

export default OpportunitiesPage;
