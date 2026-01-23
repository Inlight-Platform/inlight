import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads } from '../data/stubData';

const Index: React.FC = () => {
  const navigate = useNavigate();
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

  // Redirect to feed as the main landing page
  useEffect(() => {
    navigate('/feed', { replace: true });
  }, [navigate]);
  
  return null;
};

export default Index;
