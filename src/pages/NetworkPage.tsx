import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Download, Search, X } from 'lucide-react';

const NetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = useStore((s) => s.currentUserId);
  const get1stDegree = useStore((s) => s.get1stDegree);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'role'>('recent');

  const connections = useMemo(() => get1stDegree(currentUserId), [currentUserId, get1stDegree]);

  const filteredConnections = useMemo(() => {
    let filtered = connections.filter((user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'role':
        filtered.sort((a, b) => a.role.localeCompare(b.role));
        break;
      case 'recent':
      default:
        // Keep original order (most recent first based on stub data)
        break;
    }
    
    return filtered;
  }, [connections, searchQuery, sortBy]);

  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0];
    const headers = ['Name', 'Role', 'Location', 'Email'];
    const rows = filteredConnections.map((user) => [
      user.name,
      user.role,
      user.location,
      '', // Email would be added if public
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `\"${cell}\"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `My-Network-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleBlock = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, this would call an API
    console.log('Blocking user:', userId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-full hover:bg-accent transition-colors"
                aria-label="Go home"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-display font-bold">My Network</h1>
              <span className="text-muted-foreground">
                {filteredConnections.length} connection{filteredConnections.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportCSV}
              className="hidden sm:flex"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          
          {/* Search and filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="role">Role</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-2">
          {filteredConnections.map((user) => (
            <div
              key={user.id}
              onClick={() => handleUserClick(user.id)}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-card transition-all cursor-pointer group"
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{user.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {user.role} • {user.location}
                </p>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/messages');
                  }}
                  className="text-neon-messages"
                >
                  Message
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleBlock(user.id, e)}
                  className="text-destructive"
                >
                  Block
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredConnections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'No connections match your search.' 
                : 'No connections yet. Start networking!'}
            </p>
          </div>
        )}
        
        {/* Mobile export button */}
        <div className="fixed bottom-6 right-6 sm:hidden">
          <Button
            onClick={handleExportCSV}
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Download className="w-6 h-6" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NetworkPage;
