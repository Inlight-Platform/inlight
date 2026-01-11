import React from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Eye, MessageSquare, Calendar, Briefcase, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Simulated analytics data
const networkGrowthData = [
  { week: 'W1', connections: 12, views: 45 },
  { week: 'W2', connections: 18, views: 62 },
  { week: 'W3', connections: 15, views: 58 },
  { week: 'W4', connections: 24, views: 89 },
  { week: 'W5', connections: 31, views: 112 },
  { week: 'W6', connections: 28, views: 98 },
  { week: 'W7', connections: 35, views: 134 },
];

const engagementData = [
  { day: 'Mon', messages: 8, profileViews: 23 },
  { day: 'Tue', messages: 12, profileViews: 31 },
  { day: 'Wed', messages: 6, profileViews: 19 },
  { day: 'Thu', messages: 15, profileViews: 42 },
  { day: 'Fri', messages: 20, profileViews: 56 },
  { day: 'Sat', messages: 9, profileViews: 28 },
  { day: 'Sun', messages: 5, profileViews: 17 },
];

interface StatCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;
  
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <div className={`flex items-center gap-1 mt-2 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{Math.abs(change)}% vs last week</span>
            </div>
          </div>
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: `hsl(${color} / 0.15)` }}
          >
            <div style={{ color: `hsl(${color})` }}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PersonalAnalytics: React.FC = () => {
  const { currentUserId, get1stDegree, getMaterials, getCredits, threads, messages } = useStore();
  
  const connections = get1stDegree(currentUserId);
  const materials = getMaterials(currentUserId);
  const credits = getCredits(currentUserId);
  const userThreads = threads.filter(t => t.participants.includes(currentUserId));
  const userMessages = messages.filter(m => m.senderId === currentUserId);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Your Analytics</h2>
          <p className="text-muted-foreground">Private insights about your network and engagement</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
          🔒 Private
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Connections"
          value={connections.length}
          change={12}
          icon={<Users className="w-6 h-6" />}
          color="186 100% 50%"
        />
        <StatCard
          title="Profile Views"
          value="1,247"
          change={23}
          icon={<Eye className="w-6 h-6" />}
          color="48 100% 50%"
        />
        <StatCard
          title="Messages Sent"
          value={userMessages.length || 47}
          change={-5}
          icon={<MessageSquare className="w-6 h-6" />}
          color="264 100% 71%"
        />
        <StatCard
          title="Materials"
          value={materials.length}
          change={8}
          icon={<Briefcase className="w-6 h-6" />}
          color="147 100% 50%"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[hsl(186,100%,50%)]" />
              Network Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={networkGrowthData}>
                  <defs>
                    <linearGradient id="colorConnections" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(186, 100%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(186, 100%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(48, 100%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(48, 100%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="connections" 
                    stroke="hsl(186, 100%, 50%)" 
                    fillOpacity={1} 
                    fill="url(#colorConnections)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(48, 100%, 50%)" 
                    fillOpacity={1} 
                    fill="url(#colorViews)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(186, 100%, 50%)' }} />
                <span className="text-sm text-muted-foreground">Connections</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(48, 100%, 50%)' }} />
                <span className="text-sm text-muted-foreground">Profile Views</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[hsl(264,100%,71%)]" />
              Weekly Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="messages" fill="hsl(264, 100%, 71%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profileViews" fill="hsl(147, 100%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(264, 100%, 71%)' }} />
                <span className="text-sm text-muted-foreground">Messages</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(147, 100%, 50%)' }} />
                <span className="text-sm text-muted-foreground">Profile Views</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-3xl font-bold text-[hsl(186,100%,50%)]">{connections.filter(c => c.role === 'Actor').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Actors</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-3xl font-bold text-[hsl(48,100%,50%)]">{connections.filter(c => c.role === 'Director').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Directors</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-3xl font-bold text-[hsl(264,100%,71%)]">{connections.filter(c => c.role === 'Producer').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Producers</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-3xl font-bold text-[hsl(147,100%,50%)]">{connections.filter(c => c.role === 'Musician').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Musicians</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalAnalytics;
