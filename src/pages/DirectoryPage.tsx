import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { useStore } from '../store/useStore';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft } from 'lucide-react';

const DirectoryPage: React.FC = () => {
  const { badgeSlug } = useParams<{ badgeSlug: string }>();
  const navigate = useNavigate();
  
  const getUsersByBadge = useStore((s) => s.getUsersByBadge);
  const getConnectionStatus = useStore((s) => s.getConnectionStatus);
  const sendConnectionRequest = useStore((s) => s.sendConnectionRequest);
  const currentUserId = useStore((s) => s.currentUserId);
  
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [unionFilter, setUnionFilter] = useState<string>('all');
  
  const users = useMemo(() => {
    if (!badgeSlug) return [];
    return getUsersByBadge(badgeSlug);
  }, [badgeSlug, getUsersByBadge]);
  
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (locationFilter && !user.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      if (unionFilter !== 'all' && !user.unionStatus.toLowerCase().includes(unionFilter.toLowerCase())) return false;
      return true;
    });
  }, [users, roleFilter, locationFilter, unionFilter]);
  
  const handleConnect = (userId: string) => {
    if (userId === currentUserId) return;
    sendConnectionRequest(userId);
  };
  
  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };
  
  const roles = ['Actor', 'Producer', 'Director', 'Musician'];
  const unions = ['SAG-AFTRA', 'DGA', 'PGA', 'AFM', 'Equity'];
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => safeBack(navigate, '/people')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">
              #{badgeSlug}
            </h1>
            <span className="text-muted-foreground">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'}
            </span>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-[160px]"
            />
            
            <Select value={unionFilter} onValueChange={setUnionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Union" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Unions</SelectItem>
                {unions.map((union) => (
                  <SelectItem key={union} value={union.toLowerCase()}>{union}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      {/* Masonry Grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filteredUsers.map((user) => {
            const connectionStatus = getConnectionStatus(user.id);
            const isOwnProfile = user.id === currentUserId;
            
            return (
              <div
                key={user.id}
                className="break-inside-avoid bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Card content */}
                <div 
                  className="cursor-pointer"
                  onClick={() => handleUserClick(user.id)}
                >
                  <div className="relative aspect-[4/3]">
                    <img
                      src={user.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    
                    {/* Avatar */}
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="absolute bottom-4 left-4 w-16 h-16 rounded-full border-2 border-card object-cover"
                    />
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-lg">{user.name}</h3>
                    <p className="text-muted-foreground text-sm">{user.role} • {user.location}</p>
                    
                    {/* Secondary badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.badges.slice(0, 3).map((badge) => (
                        <span 
                          key={badge} 
                          className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                        >
                          #{badge}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Connect button */}
                {!isOwnProfile && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(user.id);
                      }}
                      disabled={connectionStatus === 'pending'}
                      className={`w-full h-10 rounded-full font-medium text-sm transition-all ${
                        connectionStatus === 'accepted'
                          ? 'bg-gradient-to-r from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white'
                          : connectionStatus === 'pending'
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {connectionStatus === 'accepted' 
                        ? 'Message' 
                        : connectionStatus === 'pending' 
                        ? 'Pending' 
                        : 'Connect'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No users found with this badge.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DirectoryPage;
