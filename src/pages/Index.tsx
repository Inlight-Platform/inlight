import React, { useEffect } from 'react';
import NavigationWheel from '../components/NavigationWheel';
import { useStore } from '../store/useStore';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads } from '../data/stubData';

const Index: React.FC = () => {
  const users = useStore((s) => s.users);
  
  useEffect(() => {
    // Initialize stub data if empty
    if (users.length === 0) {
      useStore.setState({
        users: stubUsers,
        connections: stubConnections,
        materials: stubMaterials,
        credits: stubCredits,
        stories: stubStories,
        messages: stubMessages,
        threads: stubThreads,
      });
    }
  }, [users.length]);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[600px] aspect-square">
        <NavigationWheel />
      </div>
    </div>
  );
};

export default Index;
