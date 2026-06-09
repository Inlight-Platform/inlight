import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, CalendarDays, List } from 'lucide-react';
import { useStore, EventType, Event } from '@/store/useStore';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads, stubEvents } from '@/data/stubData';
import EventCard from '@/components/events/EventCard';
import EventFilters from '@/components/events/EventFilters';
import EventCalendar from '@/components/events/EventCalendar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const users = useStore((s) => s.users);
  const events = useStore((s) => s.events);
  const { currentUserId, getUser, get1stDegree } = useStore();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'this-week' | 'this-month' | 'all'>('upcoming');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');

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
        events: stubEvents,
      });
    }
  }, [users.length]);

  const connections = get1stDegree(currentUserId);

  // Get unique locations
  const locations: string[] = useMemo(() => {
    const locs = events
      .filter((e) => !e.isVirtual)
      .map((e) => e.location);
    return [...new Set(locs)] as string[];
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.tags.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      result = result.filter((e) => e.type === selectedType);
    }

    // Location filter
    if (selectedLocation === 'virtual') {
      result = result.filter((e) => e.isVirtual);
    } else if (selectedLocation !== 'all') {
      result = result.filter((e) => e.location === selectedLocation);
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'upcoming') {
      result = result.filter((e) => new Date(e.date) >= now);
    } else if (dateFilter === 'this-week') {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      result = result.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= weekEnd;
      });
    } else if (dateFilter === 'this-month') {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      result = result.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= monthEnd;
      });
    }

    // Calendar date filter
    if (selectedDate) {
      result = result.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate.toDateString() === selectedDate.toDateString();
      });
    }

    // Sort by date
    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  }, [events, search, selectedType, selectedLocation, dateFilter, selectedDate]);

  // Get events where connections are going
  const connectionsEvents = useMemo(() => {
    return events.filter((e) =>
      e.attendees.some(
        (a) => a.status === 'going' && connections.some((c) => c.id === a.userId)
      )
    );
  }, [events, connections]);

  // Get my RSVPed events
  const myEvents = useMemo(() => {
    return events.filter((e) =>
      e.attendees.some((a) => a.userId === currentUserId && (a.status === 'going' || a.status === 'interested'))
    );
  }, [events, currentUserId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">Events</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="discover" className="space-y-6">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
              <TabsTrigger value="discover" className="flex-shrink-0 whitespace-nowrap">Discover</TabsTrigger>
              <TabsTrigger value="connections" className="flex-shrink-0 whitespace-nowrap">
                Connections ({connectionsEvents.length})
              </TabsTrigger>
              <TabsTrigger value="my-events" className="flex-shrink-0 whitespace-nowrap">
                My Events ({myEvents.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="discover" className="space-y-6">
            {/* Filters */}
            <EventFilters
              search={search}
              onSearchChange={setSearch}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              locations={locations}
            />

            {viewMode === 'calendar' ? (
              <div className="grid md:grid-cols-[300px,1fr] gap-6">
                <EventCalendar
                  events={events}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    {selectedDate
                      ? `Events on ${selectedDate.toLocaleDateString()}`
                      : 'All Events'}
                  </h3>
                  {filteredEvents.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No events found for this date.
                    </p>
                  ) : (
                    filteredEvents.map((event) => (
                      <EventCard key={event.id} event={event} compact />
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    No events found matching your filters.
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Events Your Connections Are Attending</h3>
              {connectionsEvents.length === 0 ? (
                <p className="text-muted-foreground">
                  None of your connections have RSVPed to any events yet.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectionsEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>

            {/* Connections going to events */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Network at Events</h3>
              <div className="grid gap-3">
                {connections.slice(0, 5).map((connection) => {
                  const theirEvents = events.filter((e) =>
                    e.attendees.some(
                      (a) => a.userId === connection.id && a.status === 'going'
                    )
                  );
                  if (theirEvents.length === 0) return null;
                  return (
                    <div
                      key={connection.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
                    >
                      <Avatar
                        className="w-10 h-10 cursor-pointer"
                        onClick={() => navigate(`/profile/${connection.id}`)}
                      >
                        <AvatarImage src={connection.avatar} />
                        <AvatarFallback>{connection.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{connection.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Attending {theirEvents.length} event{theirEvents.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/messages?user=${connection.id}`)}>
                        Message
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-events" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Going</h3>
              {myEvents.filter((e) =>
                e.attendees.some((a) => a.userId === currentUserId && a.status === 'going')
              ).length === 0 ? (
                <p className="text-muted-foreground">You haven't RSVPed to any events yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myEvents
                    .filter((e) =>
                      e.attendees.some((a) => a.userId === currentUserId && a.status === 'going')
                    )
                    .map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Interested</h3>
              {myEvents.filter((e) =>
                e.attendees.some((a) => a.userId === currentUserId && a.status === 'interested')
              ).length === 0 ? (
                <p className="text-muted-foreground">No interested events.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myEvents
                    .filter((e) =>
                      e.attendees.some((a) => a.userId === currentUserId && a.status === 'interested')
                    )
                    .map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default EventsPage;
