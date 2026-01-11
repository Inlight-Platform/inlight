import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import NavigationWheel from '../components/NavigationWheel';
import { useStore } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads } from '../data/stubData';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User } from 'lucide-react';

const Index: React.FC = () => {
  const users = useStore((s) => s.users);
  const { user, loading, signOut } = useAuth();
  
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

  const handleSignOut = async () => {
    await signOut();
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Auth header */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        {!loading && (
          user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" />
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm">
                <LogIn className="h-4 w-4 mr-1" />
                Sign in
              </Button>
            </Link>
          )
        )}
      </div>

      <div className="w-full max-w-[600px] aspect-square">
        <NavigationWheel />
      </div>
    </div>
  );
};

export default Index;
