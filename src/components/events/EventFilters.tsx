import React from 'react';
import { EventType } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Calendar, SlidersHorizontal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface EventFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedType: EventType | 'all';
  onTypeChange: (value: EventType | 'all') => void;
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  dateFilter: 'upcoming' | 'this-week' | 'this-month' | 'all';
  onDateFilterChange: (value: 'upcoming' | 'this-week' | 'this-month' | 'all') => void;
  locations: string[];
}

const eventTypes: { value: EventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'networking', label: 'Networking' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'screening', label: 'Screening' },
  { value: 'audition', label: 'Audition' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'conference', label: 'Conference' },
];

const dateFilters = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'all', label: 'All Dates' },
];

const EventFilters: React.FC<EventFiltersProps> = ({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedLocation,
  onLocationChange,
  dateFilter,
  onDateFilterChange,
  locations,
}) => {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {/* Type Filter */}
        <Select value={selectedType} onValueChange={(v) => onTypeChange(v as EventType | 'all')}>
          <SelectTrigger className="w-[140px]">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Location Filter */}
        <Select value={selectedLocation} onValueChange={onLocationChange}>
          <SelectTrigger className="w-[160px]">
            <MapPin className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="virtual">Virtual Only</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <div className="flex gap-1">
          {dateFilters.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={dateFilter === filter.value ? 'default' : 'outline'}
              onClick={() => onDateFilterChange(filter.value as typeof dateFilter)}
              className="text-xs"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventFilters;
