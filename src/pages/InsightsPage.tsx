import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/store/useStore';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads, stubEvents, stubOpportunities } from '@/data/stubData';
import IndustryMetrics from '@/components/insights/IndustryMetrics';
import SchoolStudios from '@/components/insights/SchoolStudios';

const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { users } = useStore();
  
  // Initialize stub data if accessing page directly
  useEffect(() => {
    if (users.length === 0) {
      useStore.setState({
        users: stubUsers,
        connections: stubConnections,
        materials: stubMaterials,
        credits: stubCredits,
        stories: stubStories,
        messages: stubMessages,
        threads: stubThreads,
        events: stubEvents,
        opportunities: stubOpportunities,
      });
    }
  }, [users.length]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold">Industry Insights</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="industry" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto">
            <TabsTrigger value="industry" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Industry
            </TabsTrigger>
            <TabsTrigger value="school" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              School
            </TabsTrigger>
          </TabsList>

          <TabsContent value="industry">
            <IndustryMetrics />
          </TabsContent>

          <TabsContent value="school">
            <SchoolStudios />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default InsightsPage;
