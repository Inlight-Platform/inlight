import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads } from '@/data/stubData';
import ThreadList from '@/components/messages/ThreadList';
import ChatThread from '@/components/messages/ChatThread';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user');

  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [showMobileChat, setShowMobileChat] = useState(false);

  const users = useStore((s) => s.users);
  const { 
    currentUserId, 
    getUser, 
    getOrCreateThread,
    get1stDegree 
  } = useStore();

  // Initialize stub data if empty
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
      });
    }
  }, [users.length]);

  const connections = get1stDegree(currentUserId);
  const selectedUser = selectedUserId ? getUser(selectedUserId) : undefined;
  useEffect(() => {
    if (userIdParam) {
      const thread = getOrCreateThread(currentUserId, userIdParam);
      setSelectedThreadId(thread.id);
      setSelectedUserId(userIdParam);
      setShowMobileChat(true);
    }
  }, [userIdParam, currentUserId, getOrCreateThread]);

  const handleSelectThread = (threadId: string, otherUserId: string) => {
    setSelectedThreadId(threadId);
    setSelectedUserId(otherUserId);
    setShowMobileChat(true);
  };

  const handleStartChat = (userId: string) => {
    const thread = getOrCreateThread(currentUserId, userId);
    setSelectedThreadId(thread.id);
    setSelectedUserId(userId);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => showMobileChat ? handleBackToList() : navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {showMobileChat && selectedUser ? (
            <div className="flex items-center gap-3">
              <Avatar 
                className="w-10 h-10 cursor-pointer" 
                onClick={() => navigate(`/profile/${selectedUserId}`)}
              >
                <AvatarImage src={selectedUser.avatar} />
                <AvatarFallback>{selectedUser.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h1 
                  className="font-semibold cursor-pointer hover:underline"
                  onClick={() => navigate(`/profile/${selectedUserId}`)}
                >
                  {selectedUser.name}
                </h1>
                <p className="text-xs text-muted-foreground">{selectedUser.role}</p>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-display font-bold">Messages</h1>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1">
          {/* Sidebar - Thread List */}
          <div className="w-80 border-r border-border flex flex-col">
            <ThreadList 
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
            />
            
            {/* Quick Start - Connections */}
            {connections.length > 0 && (
              <div className="border-t border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">Start a conversation</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {connections.slice(0, 5).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleStartChat(user.id)}
                      className="flex flex-col items-center gap-1 min-w-[60px]"
                    >
                      <Avatar className="w-10 h-10 ring-2 ring-transparent hover:ring-primary transition-all">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate max-w-[60px]">{user.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedThreadId && selectedUserId ? (
              <ChatThread threadId={selectedThreadId} otherUserId={selectedUserId} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose from your existing conversations or start a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden flex-1 flex flex-col">
          {showMobileChat && selectedThreadId && selectedUserId ? (
            <ChatThread threadId={selectedThreadId} otherUserId={selectedUserId} />
          ) : (
            <div className="flex flex-col flex-1">
              <ThreadList 
                selectedThreadId={selectedThreadId}
                onSelectThread={handleSelectThread}
              />
              
              {/* Quick Start - Connections */}
              {connections.length > 0 && (
                <div className="border-t border-border p-4">
                  <p className="text-xs text-muted-foreground mb-2">Start a conversation</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {connections.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartChat(user.id)}
                        className="flex flex-col items-center gap-1 min-w-[60px]"
                      >
                        <Avatar className="w-12 h-12 ring-2 ring-transparent hover:ring-primary transition-all">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>{user.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs truncate max-w-[60px]">{user.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
