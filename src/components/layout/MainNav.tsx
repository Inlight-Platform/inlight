import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Briefcase, BookOpen, Theater, Settings, LogOut, LogIn, PanelLeftClose, PanelLeft, Bell, Shield, Sparkles, PieChart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useMessages } from '@/hooks/useMessages';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { SignOutDialog } from '@/components/ui/sign-out-dialog';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
  accent?: boolean;
  useInlightIcon?: boolean;
}

// Custom Home icon component using Inlight logo
const InlightHomeIcon: React.FC<{className?: string;}> = ({ className }) =>
<img
  src={inlightLogo}
  alt="Home"
  className={cn("rounded-full object-cover", className)}
  style={{ width: '1.25rem', height: '1.25rem' }} />;



const navItems: NavItem[] = [
{ label: 'Home', icon: Home, path: '/feed' },
{ label: 'People', icon: Users, path: '/people' },
{ label: 'Jobs', icon: Briefcase, path: '/opportunities', accent: true },
{ label: 'Industry Now', icon: Theater, path: '/stage-whisper' },
{ label: 'Resources', icon: BookOpen, path: '/resources' }];


export const MainNav: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const { totalUnread } = useMessages();
  const { unreadCount: notifUnreadCount } = useNotifications();
  const combinedUnread = totalUnread + notifUnreadCount;
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = () => {
    setShowSignOutDialog(false);
    signOut();
  };

  const { data: profile } = useQuery({
    queryKey: ['nav-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.
      from('profiles').
      select('display_name, avatar_url').
      eq('user_id', user.id).
      maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Build nav items with notifications at top when user is logged in
  const allNavItems: NavItem[] = user ?
  [{ label: 'Notifications', icon: Bell, path: '/notifications', badge: combinedUnread > 0 ? combinedUnread : undefined }, ...navItems] :
  navItems;

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop Sidebar - Premium dark design */}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 h-full flex-col z-50 transition-all duration-300 ease-in-out",
          "bg-gradient-to-b from-[hsl(222_32%_10%)] via-[hsl(222_35%_8%)] to-[hsl(222_38%_6%)]",
          "border-r border-[hsl(45_95%_58%/0.1)]",
          collapsed ? "w-16" : "w-64"
        )}>

        {/* Decorative gold line at top */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(45_95%_58%/0.5)] to-transparent" />
        
        {/* Logo with gold accent - circular styling */}
        <div className={cn("border-b border-[hsl(45_95%_58%/0.1)] relative", collapsed ? "p-3" : "p-6")}>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img

                alt="Inlight"
                className={cn(
                  "transition-all relative z-10 rounded-full object-cover ring-2 ring-[hsl(45_95%_58%/0.3)] group-hover:ring-[hsl(45_95%_58%/0.6)]",
                  collapsed ? "h-8 w-8" : "h-10 w-10"
                )} src={inlightLogo} />

              <div className="absolute inset-0 blur-lg bg-[hsl(45_95%_58%/0.2)] opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
            </div>
            {!collapsed &&
            <span className="text-xl font-display font-bold tracking-wide bg-gradient-to-r from-white to-[hsl(45_95%_58%)] bg-clip-text text-transparent">
                Inlight
              </span>
            }
          </Link>
        </div>

        {/* Nav Items */}
        <nav className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-4")}>

          {allNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            const linkContent =
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3',
                active ?
                'bg-gradient-to-r from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white shadow-lg shadow-[hsl(220_85%_55%/0.3)]' :
                item.accent ?
                'text-[hsl(45_95%_58%)] hover:bg-[hsl(45_95%_58%/0.1)] hover:text-[hsl(45_95%_68%)]' :
                'text-[hsl(220_15%_70%)] hover:bg-[hsl(220_30%_15%)] hover:text-white'
              )}>

                {/* Gold accent indicator for active state */}
                {active &&
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[hsl(45_95%_58%)]" />
              }
                
                <div className="relative">
                  {item.useInlightIcon ?
                <InlightHomeIcon className={cn(
                  "transition-transform group-hover:scale-110",
                  active && "ring-2 ring-white"
                )} /> :

                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110",
                  item.accent && !active && "text-[hsl(45_95%_58%)]"
                )} />
                }
                  {item.badge && item.badge > 0 &&
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-[hsl(45_95%_58%)] text-[hsl(222_35%_8%)] rounded-full px-1 shadow-lg shadow-[hsl(45_95%_58%/0.4)]">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                }
                </div>
                {!collapsed &&
              <>
                    <span className={cn(item.accent && !active && "font-semibold")}>{item.label}</span>
                    {item.badge && item.badge > 0 &&
                <Badge className="ml-auto text-xs px-1.5 py-0.5 bg-[hsl(45_95%_58%)] text-[hsl(222_35%_8%)] hover:bg-[hsl(45_95%_68%)]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                }
                    {item.accent && !active &&
                <Sparkles className="w-3 h-3 ml-auto text-[hsl(45_95%_58%)] opacity-60" />
                }
                  </>
              }
              </Link>;


            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">
                    {item.label}
                    {item.badge && item.badge > 0 && ` (${item.badge})`}
                  </TooltipContent>
                </Tooltip>);

            }

            return linkContent;
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className={cn("px-2 py-2", collapsed ? "flex justify-center" : "")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="h-9 w-9 text-[hsl(220_15%_60%)] hover:text-[hsl(45_95%_58%)] hover:bg-[hsl(45_95%_58%/0.1)] transition-colors">

                {collapsed ?
                <PanelLeft className="w-5 h-5" /> :

                <PanelLeftClose className="w-5 h-5" />
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* User Section - Premium styling */}
        <div className={cn("border-t border-[hsl(45_95%_58%/0.1)]", collapsed ? "p-2" : "p-4")}>
          {user ?
          <div className="space-y-2">
              {collapsed ?
            <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                    to={`/profile/${user.id}`}
                    className="flex items-center justify-center py-3 rounded-xl hover:bg-[hsl(220_30%_15%)] transition-colors group">

                        <div className="relative">
                          <Avatar className="w-8 h-8 ring-2 ring-[hsl(45_95%_58%/0.3)] group-hover:ring-[hsl(45_95%_58%/0.6)] transition-all">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white">
                              {profile?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">
                      {profile?.display_name || 'My Profile'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                    to="/settings"
                    className="flex items-center justify-center py-3 rounded-xl text-[hsl(220_15%_60%)] hover:bg-[hsl(220_30%_15%)] hover:text-white transition-colors">

                        <Settings className="w-5 h-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">Settings</TooltipContent>
                  </Tooltip>
                  {isAdmin &&
              <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                    to="/admin"
                    className="flex items-center justify-center py-3 rounded-xl text-[hsl(45_95%_58%)] hover:bg-[hsl(45_95%_58%/0.1)] transition-colors">

                          <Shield className="w-5 h-5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">Admin</TooltipContent>
                    </Tooltip>
              }
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                    onClick={() => setShowSignOutDialog(true)}
                    className="w-full flex items-center justify-center py-3 rounded-xl text-[hsl(220_15%_60%)] hover:bg-[hsl(0_75%_55%/0.1)] hover:text-[hsl(0_75%_60%)] transition-colors">

                        <LogOut className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">Sign out</TooltipContent>
                  </Tooltip>
                </> :

            <>
                  <Link
                to={`/profile/${user.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[hsl(220_30%_15%)] transition-colors group">

                    <Avatar className="w-8 h-8 ring-2 ring-[hsl(45_95%_58%/0.3)] group-hover:ring-[hsl(45_95%_58%/0.6)] transition-all">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white">
                        {profile?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate text-white">
                      {profile?.display_name || 'My Profile'}
                    </span>
                  </Link>
                  <Link
                to="/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[hsl(220_15%_60%)] hover:bg-[hsl(220_30%_15%)] hover:text-white transition-colors">

                    <Settings className="w-5 h-5" />
                    Settings
                  </Link>
                  {isAdmin &&
              <Link
                to="/admin"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[hsl(45_95%_58%)] hover:bg-[hsl(45_95%_58%/0.1)] transition-colors">

                      <Shield className="w-5 h-5" />
                      Admin
                    </Link>
              }
                  <button
                onClick={() => setShowSignOutDialog(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-[hsl(220_15%_60%)] hover:bg-[hsl(0_75%_55%/0.1)] hover:text-[hsl(0_75%_60%)] transition-colors">

                    <LogOut className="w-5 h-5" />
                    Sign out
                  </button>
                </>
            }
            </div> :

          collapsed ?
          <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                to="/auth"
                className="flex items-center justify-center py-3 rounded-xl bg-gradient-to-r from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white font-medium shadow-lg shadow-[hsl(220_85%_55%/0.3)] hover:shadow-[hsl(220_85%_55%/0.5)] transition-shadow">

                    <LogIn className="w-5 h-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[hsl(222_30%_12%)] border-[hsl(45_95%_58%/0.2)] text-white">Sign in</TooltipContent>
              </Tooltip> :

          <Link
            to="/auth"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white font-medium shadow-lg shadow-[hsl(220_85%_55%/0.3)] hover:shadow-[hsl(220_85%_55%/0.5)] transition-shadow">

                <LogIn className="w-5 h-5" />
                Sign in
              </Link>

          }
        </div>
        
        {/* Decorative bottom glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[hsl(45_95%_58%/0.3)] to-transparent" />
      </aside>

      {/* Mobile Bottom Nav - Premium dark design */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-pb bg-gradient-to-t from-[hsl(222_38%_6%)] via-[hsl(222_35%_8%)] to-[hsl(222_32%_10%)] border-t border-[hsl(45_95%_58%/0.1)]">
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(45_95%_58%/0.4)] to-transparent" />
        
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-2 py-2">
          {/* Notifications for mobile */}
          {user &&
          <Link
            to="/notifications"
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all relative flex-shrink-0 min-w-[72px]',
              isActive('/notifications') ?
              'text-[hsl(45_95%_58%)]' :
              'text-[hsl(220_15%_60%)]'
            )}>
              <div className="relative">
                <Bell className="w-5 h-5" />
                {combinedUnread > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold bg-[hsl(45_95%_58%)] text-[hsl(222_35%_8%)] rounded-full px-0.5">
                    {combinedUnread > 99 ? '99+' : combinedUnread}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-none whitespace-nowrap">Notifications</span>
            </Link>
          }

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-shrink-0 min-w-[72px] relative',
                  active ?
                  'text-white' :
                  item.accent ?
                  'text-[hsl(45_95%_58%)]' :
                  'text-[hsl(220_15%_60%)]'
                )}>

                {active &&
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220_85%_55%/0.2)] to-transparent rounded-lg" />
                }
                <Icon className={cn("w-5 h-5 relative z-10", item.accent && !active && "text-[hsl(45_95%_58%)]")} />
                <span className={cn(
                  "text-[10px] leading-none whitespace-nowrap relative z-10",
                  active && "font-medium"
                )}>{item.label}</span>
                {active &&
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[hsl(45_95%_58%)]" />
                }
              </Link>);

          })}

          {user ?
          <Link
            to={`/profile/${user.id}`}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all flex-shrink-0 min-w-[72px]',
              isActive(`/profile/${user.id}`) ? 'text-white' : 'text-[hsl(220_15%_60%)]'
            )}>

              <Avatar className={cn(
              "w-5 h-5 ring-1 transition-all",
              isActive(`/profile/${user.id}`) ?
              "ring-[hsl(45_95%_58%)]" :
              "ring-[hsl(45_95%_58%/0.3)]"
            )}>
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-gradient-to-br from-[hsl(220_85%_55%)] to-[hsl(240_70%_50%)] text-white">
                  {profile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] leading-none whitespace-nowrap">Profile</span>
            </Link> :

          <Link
            to="/auth"
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-[hsl(45_95%_58%)] flex-shrink-0 min-w-[72px]">

              <LogIn className="w-5 h-5" />
              <span className="text-[10px] leading-none whitespace-nowrap font-medium">Sign in</span>
            </Link>
          }
        </div>
      </nav>

      {/* Sign Out Confirmation Dialog */}
      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={handleSignOut} />

    </TooltipProvider>);

};

export default MainNav;