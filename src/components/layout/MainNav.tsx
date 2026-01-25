import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Briefcase, FolderKanban, BookOpen, Theater, Settings, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import inlightLogo from '@/assets/inlight-logo.png';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Feed', icon: Home, path: '/feed' },
  { label: 'People', icon: Users, path: '/people' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Opportunities', icon: Briefcase, path: '/opportunities' },
  { label: 'Stage Whisper', icon: Theater, path: '/stage-whisper' },
  { label: 'Resources', icon: BookOpen, path: '/resources' },
];

export const MainNav: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['nav-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col bg-card border-r border-border z-50">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <img src={inlightLogo} alt="Inlight" className="h-10 w-auto" />
            <span className="text-xl font-display font-bold tracking-wide">Inlight</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          {user ? (
            <div className="space-y-2">
              <Link
                to={`/profile/${user.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent transition-colors"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {profile?.display_name || 'My Profile'}
                </span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
            >
              <LogIn className="w-5 h-5" />
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
          {user ? (
            <Link
              to={`/profile/${user.id}`}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive(`/profile/${user.id}`) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Avatar className="w-5 h-5">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">
                  {profile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">Profile</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground"
            >
              <LogIn className="w-5 h-5" />
              <span className="text-xs">Sign in</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
};

export default MainNav;
