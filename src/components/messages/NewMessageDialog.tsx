import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NewMessageDialogProps {
  onSelectUser: (userId: string) => void;
  trigger?: React.ReactNode;
}

export const NewMessageDialog: React.FC<NewMessageDialogProps> = ({ 
  onSelectUser,
  trigger 
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  // Fetch all users matching the search query
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['users-for-messaging', user?.id, search],
    queryFn: async () => {
      if (!user?.id) return [];

      // If no search, show recent or suggested users
      let query = supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, headline')
        .neq('user_id', user.id)
        .limit(50);

      // Apply search filter if provided
      if (search.trim()) {
        query = query.or(`display_name.ilike.%${search}%,headline.ilike.%${search}%`);
      }

      const { data: profiles } = await query.order('display_name');

      return profiles || [];
    },
    enabled: !!user?.id && open,
  });

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquare className="w-4 h-4 mr-2" />
            New Message
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for anyone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-72">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? (
                  <p className="text-sm">No users match "{search}"</p>
                ) : (
                  <>
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Start typing to search</p>
                    <p className="text-xs mt-1">Find anyone on the platform</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((profile) => (
                  <button
                    key={profile.user_id}
                    onClick={() => handleSelectUser(profile.user_id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-lg transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {profile.display_name || 'Unknown'}
                      </p>
                      {profile.headline && (
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.headline}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewMessageDialog;
