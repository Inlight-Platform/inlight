import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft } from 'lucide-react';

const MutualsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = useStore((s) => s.currentUserId);
  const get1stDegree = useStore((s) => s.get1stDegree);
  const get2ndDegree = useStore((s) => s.get2ndDegree);
  const get3rdDegree = useStore((s) => s.get3rdDegree);
  const getMutualCount = useStore((s) => s.getMutualCount);
  const getConnectionStatus = useStore((s) => s.getConnectionStatus);
  const sendConnectionRequest = useStore((s) => s.sendConnectionRequest);
  
  const [activeTab, setActiveTab] = useState('1st');
  
  const firstDegree = useMemo(() => get1stDegree(currentUserId), [currentUserId, get1stDegree]);
  const secondDegree = useMemo(() => get2ndDegree(currentUserId), [currentUserId, get2ndDegree]);
  const thirdDegree = useMemo(() => get3rdDegree(currentUserId), [currentUserId, get3rdDegree]);
  
  const handleConnect = (userId: string) => {
    sendConnectionRequest(userId);
  };
  
  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };
  
  const renderUserCard = (user: ReturnType<typeof get1stDegree>[0], degree: number) => {
    const connectionStatus = getConnectionStatus(user.id);
    const mutualCount = getMutualCount(user.id);
    
    return (
      <div
        key={user.id}
        className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow"
      >
        <div 
          className="cursor-pointer"
          onClick={() => handleUserClick(user.id)}
        >
          <div className="flex items-center gap-4 p-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <span className={`absolute -bottom-1 -right-1 degree-badge degree-${degree}`}>
                {degree}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold truncate">{user.name}</h3>
              <p className="text-muted-foreground text-sm truncate">{user.role}</p>
              {mutualCount > 0 && degree !== 1 && (
                <p className="text-sm text-muted-foreground">
                  {mutualCount} mutual connection{mutualCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {degree !== 1 && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConnect(user.id);
              }}
              disabled={connectionStatus === 'pending'}
              className={`w-full h-9 rounded-full font-medium text-sm transition-all ${
                connectionStatus === 'pending'
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {connectionStatus === 'pending' ? 'Pending' : 'Connect'}
            </button>
          </div>
        )}
        
        {degree === 1 && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/messages');
              }}
              className="w-full h-9 rounded-full font-medium text-sm bg-gradient-to-r from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white hover:opacity-90 transition-all"
            >
              Message
            </button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Go home"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">Mutuals & Explore</h1>
          </div>
        </div>
      </header>
      
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
            <TabsTrigger value="1st" className="data-[state=active]:bg-neon-mutuals/20">
              Mutuals ({firstDegree.length})
            </TabsTrigger>
            <TabsTrigger value="2nd" className="data-[state=active]:bg-neon-messages/20">
              2nd Degree ({secondDegree.length})
            </TabsTrigger>
            <TabsTrigger value="3rd" className="data-[state=active]:bg-neon-insights/20">
              3rd Degree ({thirdDegree.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="1st">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {firstDegree.map((user) => renderUserCard(user, 1))}
            </div>
            {firstDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No connections yet. Start connecting with others!
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="2nd">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondDegree.map((user) => renderUserCard(user, 2))}
            </div>
            {secondDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No 2nd-degree connections found.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="3rd">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {thirdDegree.map((user) => renderUserCard(user, 3))}
            </div>
            {thirdDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No 3rd-degree connections found.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MutualsPage;
