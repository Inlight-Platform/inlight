import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Clock } from 'lucide-react';
import { useStore, Story } from '@/store/useStore';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { StoryCreator } from '@/components/stories/StoryCreator';
import { StoryRing } from '@/components/stories/StoryRing';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const StoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreator, setShowCreator] = useState(false);
  const [viewingStories, setViewingStories] = useState<Story[] | null>(null);
  const [viewingStartIndex, setViewingStartIndex] = useState(0);

  const { 
    users, 
    currentUserId, 
    getActiveStories, 
    getUser, 
    get1stDegree,
    cleanupExpiredStories 
  } = useStore();

  // Cleanup expired stories on mount
  React.useEffect(() => {
    cleanupExpiredStories();
  }, [cleanupExpiredStories]);

  const currentUser = getUser('me');
  const connections = get1stDegree(currentUserId);
  
  // Get all active stories grouped by user
  const storiesByUser = useMemo(() => {
    const map = new Map<string, Story[]>();
    
    // Current user's stories
    const myStories = getActiveStories(currentUserId);
    if (myStories.length > 0) {
      map.set(currentUserId, myStories);
    }
    
    // Connection's stories
    connections.forEach(conn => {
      const stories = getActiveStories(conn.id);
      if (stories.length > 0) {
        map.set(conn.id, stories);
      }
    });
    
    return map;
  }, [currentUserId, connections, getActiveStories]);

  // Get all stories for the feed (excluding current user)
  const allStories = useMemo(() => {
    const stories: Story[] = [];
    storiesByUser.forEach((userStories, userId) => {
      if (userId !== currentUserId) {
        stories.push(...userStories);
      }
    });
    return stories.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [storiesByUser, currentUserId]);

  const myStories = storiesByUser.get(currentUserId) || [];

  const handleViewStories = (userId: string) => {
    const stories = storiesByUser.get(userId);
    if (stories && stories.length > 0) {
      setViewingStories(stories);
      setViewingStartIndex(0);
    }
  };

  const handleViewAllStories = (startIndex: number = 0) => {
    if (allStories.length > 0) {
      setViewingStories(allStories);
      setViewingStartIndex(startIndex);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Back to home"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] bg-clip-text text-transparent">
            Stories
          </h1>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Story rings row */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {/* Create story button / Your story */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
            {myStories.length > 0 ? (
              <StoryRing
                user={currentUser!}
                stories={myStories}
                onClick={() => handleViewStories(currentUserId)}
                currentUserId={currentUserId}
                showName={false}
              />
            ) : (
              <button
                onClick={() => setShowCreator(true)}
                className="w-16 h-16 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors relative"
              >
                {currentUser && (
                  <img
                    src={currentUser.avatar}
                    alt="Your story"
                    className="w-full h-full rounded-full object-cover opacity-50"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              </button>
            )}
            <span className="text-xs text-foreground">Your story</span>
          </div>

          {/* Other users with stories */}
          {Array.from(storiesByUser.entries())
            .filter(([userId]) => userId !== currentUserId)
            .map(([userId, stories]) => {
              const user = getUser(userId);
              if (!user) return null;
              return (
                <StoryRing
                  key={userId}
                  user={user}
                  stories={stories}
                  onClick={() => handleViewStories(userId)}
                  currentUserId={currentUserId}
                />
              );
            })}
        </div>

        {/* Create story CTA if no stories */}
        {myStories.length === 0 && (
          <div 
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(330,100%,64%)/0.1] to-[hsl(350,100%,70%)/0.1] border border-[hsl(330,100%,64%)/0.3] p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Share your moment</h3>
                <p className="text-muted-foreground text-sm">
                  Create a story that disappears in 24 hours
                </p>
              </div>
              <button
                onClick={() => setShowCreator(true)}
                className="p-4 rounded-full bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white hover:opacity-90 transition-opacity"
                aria-label="Create story"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Stories feed - vertical 9:16 cards */}
        {allStories.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Recent Stories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allStories.map((story, index) => {
                const user = getUser(story.userId);
                if (!user) return null;
                
                return (
                  <button
                    key={story.id}
                    onClick={() => handleViewAllStories(index)}
                    className="relative aspect-[9/16] rounded-xl overflow-hidden group"
                  >
                    {story.type === 'video' ? (
                      <video
                        src={story.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={story.url}
                        alt="Story"
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
                    
                    {/* User info */}
                    <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover border-2 border-white"
                      />
                      <span className="text-white text-sm font-medium truncate">
                        {user.name.split(' ')[0]}
                      </span>
                    </div>
                    
                    {/* Expiration timer */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 text-white/80 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeRemaining(story.expiresAt)}</span>
                    </div>

                    {/* Caption preview */}
                    {story.caption && (
                      <div className="absolute bottom-3 right-3 left-10">
                        <p className="text-white text-xs truncate">
                          {story.caption}
                        </p>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {allStories.length === 0 && myStories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div 
              className="w-24 h-24 rounded-full mb-6"
              style={{ 
                background: 'linear-gradient(135deg, hsl(330 100% 64%), hsl(350 100% 70%))',
                boxShadow: '0 0 40px hsl(330 100% 64% / 0.4)'
              }}
            />
            <h3 className="text-xl font-semibold mb-2">No stories yet</h3>
            <p className="text-muted-foreground max-w-xs">
              Be the first to share a story! Stories disappear after 24 hours.
            </p>
          </div>
        )}
      </main>

      {/* Floating create button */}
      <button
        onClick={() => setShowCreator(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all z-30"
        aria-label="Create story"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Story Viewer Modal */}
      {viewingStories && (
        <StoryViewer
          stories={viewingStories}
          initialIndex={viewingStartIndex}
          onClose={() => setViewingStories(null)}
        />
      )}

      {/* Story Creator Modal */}
      {showCreator && (
        <StoryCreator
          onClose={() => setShowCreator(false)}
          onStoryCreated={() => {}}
        />
      )}
    </div>
  );
};

export default StoriesPage;
