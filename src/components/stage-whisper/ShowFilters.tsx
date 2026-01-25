import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterState {
  category: string[];
  showType: string[];
  priceTier: string[];
  borough: string[];
  accessibility: string[];
}

interface ShowFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
}

const CATEGORIES = [
  { value: 'broadway', label: 'Broadway', emoji: '⭐' },
  { value: 'off-broadway', label: 'Off-Broadway', emoji: '🌟' },
  { value: 'off-off-broadway', label: 'Off-Off-Broadway', emoji: '✨' },
];

const SHOW_TYPES = [
  { value: 'musical', label: 'Musical', emoji: '🎵' },
  { value: 'play', label: 'Play', emoji: '🎭' },
  { value: 'opera', label: 'Opera', emoji: '🎼' },
  { value: 'dance', label: 'Dance', emoji: '💃' },
  { value: 'other', label: 'Other', emoji: '🎪' },
];

const PRICE_TIERS = [
  { value: 'budget', label: 'Budget', display: '$' },
  { value: 'moderate', label: 'Moderate', display: '$$' },
  { value: 'premium', label: 'Premium', display: '$$$' },
];

const BOROUGHS = [
  { value: 'Manhattan', label: 'Manhattan' },
  { value: 'Brooklyn', label: 'Brooklyn' },
  { value: 'Queens', label: 'Queens' },
  { value: 'Bronx', label: 'Bronx' },
  { value: 'Staten Island', label: 'Staten Island' },
];

const ACCESSIBILITY = [
  { value: 'wheelchair', label: 'Wheelchair Accessible', emoji: '♿' },
  { value: 'hearing-loop', label: 'Hearing Loop', emoji: '👂' },
  { value: 'asl', label: 'ASL Interpreted', emoji: '🤟' },
  { value: 'audio-description', label: 'Audio Description', emoji: '🔊' },
];

export const ShowFilters: React.FC<ShowFiltersProps> = ({
  filters,
  onFilterChange,
  onClearAll,
}) => {
  const toggleFilter = (category: keyof FilterState, value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFilterChange({ ...filters, [category]: updated });
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);
  const activeCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Filters</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} active
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Stage</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => toggleFilter('category', cat.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filters.category.includes(cat.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show Type Filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Genre</p>
        <div className="flex flex-wrap gap-2">
          {SHOW_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => toggleFilter('showType', type.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filters.showType.includes(type.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {type.emoji} {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Price</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_TIERS.map(tier => (
            <button
              key={tier.value}
              onClick={() => toggleFilter('priceTier', tier.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filters.priceTier.includes(tier.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {tier.display} {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* Borough Filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Borough</p>
        <div className="flex flex-wrap gap-2">
          {BOROUGHS.map(borough => (
            <button
              key={borough.value}
              onClick={() => toggleFilter('borough', borough.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filters.borough.includes(borough.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {borough.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accessibility Filter */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Accessibility</p>
        <div className="flex flex-wrap gap-2">
          {ACCESSIBILITY.map(access => (
            <button
              key={access.value}
              onClick={() => toggleFilter('accessibility', access.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filters.accessibility.includes(access.value)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {access.emoji} {access.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShowFilters;
