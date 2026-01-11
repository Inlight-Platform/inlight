import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus, Briefcase, Send, FileText } from 'lucide-react';
import { useOpportunitiesStore } from '@/store/opportunitiesStore';
import { useStore, UserRole } from '@/store/useStore';
import { stubOpportunities } from '@/data/stubOpportunities';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import OpportunityFilters from '@/components/opportunities/OpportunityFilters';
import OpportunityDetail from '@/components/opportunities/OpportunityDetail';
import PostOpportunityModal from '@/components/opportunities/PostOpportunityModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type TabValue = 'browse' | 'posts' | 'applied';

const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { 
    opportunities, 
    getOpportunities, 
    getOpportunity, 
    getUserPosts, 
    getApplications 
  } = useOpportunitiesStore();
  const { currentUserId, users } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabValue>(
    (searchParams.get('tab') as TabValue) || 'browse'
  );
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(
    searchParams.get('id')
  );
  const [showPostModal, setShowPostModal] = useState(false);
  
  // Filter state
  const [keyword, setKeyword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [paidOnly, setPaidOnly] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  
  // Initialize stub data if empty
  useEffect(() => {
    if (opportunities.length === 0 && users.length > 0) {
      useOpportunitiesStore.setState({ opportunities: stubOpportunities });
    }
  }, [opportunities.length, users.length]);
  
  // Sync URL with tab
  useEffect(() => {
    setSearchParams(params => {
      params.set('tab', activeTab);
      if (selectedOpportunity) {
        params.set('id', selectedOpportunity);
      } else {
        params.delete('id');
      }
      return params;
    });
  }, [activeTab, selectedOpportunity, setSearchParams]);
  
  const hasActiveFilters = keyword !== '' || selectedRole !== null || paidOnly || remoteOnly;
  
  const clearFilters = () => {
    setKeyword('');
    setSelectedRole(null);
    setPaidOnly(false);
    setRemoteOnly(false);
  };
  
  const filteredOpportunities = getOpportunities({
    keyword: keyword || undefined,
    role: selectedRole || undefined,
    paid: paidOnly ? true : undefined,
    remote: remoteOnly ? true : undefined,
  });
  
  const myPosts = getUserPosts(currentUserId);
  const myApplications = getApplications(currentUserId);
  const appliedOpportunities = myApplications
    .map(app => getOpportunity(app.opportunityId))
    .filter(Boolean);
  
  const openDetail = (id: string) => setSelectedOpportunity(id);
  const closeDetail = () => setSelectedOpportunity(null);
  
  const currentOpportunity = selectedOpportunity ? getOpportunity(selectedOpportunity) : null;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">Opportunities</h1>
          </div>
          
          <Button
            onClick={() => setShowPostModal(true)}
            className="bg-[#00FF87] text-black hover:bg-[#00FF87]/90 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post an Opportunity
          </Button>
        </div>
      </header>
      
      {/* Tabs */}
      <div className="sticky top-[73px] z-30 bg-background border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="h-12 bg-transparent border-0 p-0 gap-6">
              <TabsTrigger 
                value="browse"
                className={cn(
                  "h-12 px-0 border-b-2 rounded-none data-[state=active]:border-[#00FF87] data-[state=active]:text-foreground",
                  "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Browse
              </TabsTrigger>
              <TabsTrigger 
                value="posts"
                className={cn(
                  "h-12 px-0 border-b-2 rounded-none data-[state=active]:border-[#00FF87] data-[state=active]:text-foreground",
                  "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-4 h-4 mr-2" />
                My Posts
                {myPosts.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
                    {myPosts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="applied"
                className={cn(
                  "h-12 px-0 border-b-2 rounded-none data-[state=active]:border-[#00FF87] data-[state=active]:text-foreground",
                  "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Send className="w-4 h-4 mr-2" />
                Applied
                {myApplications.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
                    {myApplications.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Main content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Filters */}
            <OpportunityFilters
              keyword={keyword}
              onKeywordChange={setKeyword}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              paidOnly={paidOnly}
              onPaidChange={setPaidOnly}
              remoteOnly={remoteOnly}
              onRemoteChange={setRemoteOnly}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
            
            {/* Results */}
            {filteredOpportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOpportunities.map(opp => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => openDetail(opp.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No opportunities found
                </h3>
                <p className="text-muted-foreground max-w-md">
                  No opportunities match your filters—try clearing keyword or widening location.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mt-4"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'posts' && (
          <div>
            {myPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myPosts.map(opp => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => openDetail(opp.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No posts yet
                </h3>
                <p className="text-muted-foreground max-w-md">
                  You haven't posted yet—click + to create your first opportunity.
                </p>
                <Button
                  onClick={() => setShowPostModal(true)}
                  className="mt-4 bg-[#00FF87] text-black hover:bg-[#00FF87]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Post an Opportunity
                </Button>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'applied' && (
          <div>
            {appliedOpportunities.length > 0 ? (
              <div className="space-y-3">
                {appliedOpportunities.map(opp => opp && (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => openDetail(opp.id)}
                    compact
                    showAppliedBadge
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Send className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No applications yet
                </h3>
                <p className="text-muted-foreground max-w-md">
                  You haven't applied to any opportunities—start browsing!
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('browse')}
                  className="mt-4"
                >
                  Browse Opportunities
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Detail modal */}
      <OpportunityDetail
        opportunity={currentOpportunity || null}
        open={!!selectedOpportunity && !!currentOpportunity}
        onClose={closeDetail}
      />
      
      {/* Post modal */}
      <PostOpportunityModal
        open={showPostModal}
        onClose={() => setShowPostModal(false)}
      />
    </div>
  );
};

export default OpportunitiesPage;
