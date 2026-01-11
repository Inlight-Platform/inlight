import React from 'react';
import { Bookmark, Share2, MapPin, Clock, Users, Briefcase, DollarSign, Building } from 'lucide-react';
import { Opportunity } from '@/store/opportunitiesStore';
import { useOpportunitiesStore } from '@/store/opportunitiesStore';
import { useStore } from '@/store/useStore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick: () => void;
  compact?: boolean;
  showAppliedBadge?: boolean;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ 
  opportunity, 
  onClick, 
  compact = false,
  showAppliedBadge = false 
}) => {
  const { toggleBookmark, isBookmarked, hasApplied } = useOpportunitiesStore();
  const currentUserId = useStore(s => s.currentUserId);
  const { toast } = useToast();
  
  const bookmarked = isBookmarked(opportunity.id);
  const applied = hasApplied(opportunity.id, currentUserId);
  
  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(opportunity.id);
    toast({
      title: bookmarked ? 'Removed from saved' : 'Saved opportunity',
      duration: 2000,
    });
  };
  
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://inlight.app/opportunities/${opportunity.id}`);
    toast({
      title: 'Link copied',
      description: 'Share this opportunity with your network',
      duration: 2000,
    });
  };
  
  const getDeadlineText = () => {
    const deadline = new Date(opportunity.deadline);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Ends today';
    if (diffDays === 1) return 'Ends tomorrow';
    if (diffDays <= 7) return `${diffDays} days left`;
    return `${diffDays} days left`;
  };
  
  const deadlineText = getDeadlineText();
  const isUrgent = deadlineText.includes('today') || deadlineText.includes('tomorrow');
  
  if (compact) {
    return (
      <div
        onClick={onClick}
        className="group p-4 bg-card hover:bg-accent/50 rounded-xl border border-border hover:border-[#00FF87]/30 transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
      >
        <div className="flex items-center gap-3">
          {opportunity.logoURL && (
            <img 
              src={opportunity.logoURL} 
              alt={opportunity.companyName}
              className="w-10 h-10 rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{opportunity.title}</h4>
            <p className="text-sm text-muted-foreground truncate">{opportunity.companyName}</p>
          </div>
          {(showAppliedBadge || applied) && (
            <Badge variant="secondary" className="bg-[#00FF87]/20 text-[#00FF87] border-[#00FF87]/30">
              Applied
            </Badge>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <article
      onClick={onClick}
      className="group relative bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-[#00FF87]/30"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${opportunity.title} at ${opportunity.companyName}`}
    >
      {/* Cover Image */}
      {opportunity.coverImage && (
        <div className="relative h-36 overflow-hidden">
          <img 
            src={opportunity.coverImage} 
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
          
          {/* Action buttons */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={handleBookmark}
              className={cn(
                "p-2 rounded-full backdrop-blur-sm transition-all",
                bookmarked 
                  ? "bg-[#00FF87] text-black" 
                  : "bg-black/50 text-white hover:bg-black/70"
              )}
              aria-pressed={bookmarked}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark opportunity'}
            >
              <Bookmark className={cn("w-4 h-4", bookmarked && "fill-current")} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all"
              aria-label="Share opportunity"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Applied badge */}
          {(showAppliedBadge || applied) && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-[#00FF87] text-black font-semibold">
                Applied
              </Badge>
            </div>
          )}
        </div>
      )}
      
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {opportunity.logoURL && (
            <img 
              src={opportunity.logoURL} 
              alt={opportunity.companyName}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-foreground line-clamp-2 group-hover:text-[#00FF87] transition-colors">
              {opportunity.title}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <Building className="w-3.5 h-3.5" />
              <span className="truncate">{opportunity.companyName}</span>
            </div>
          </div>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">
            {opportunity.typeTag}
          </Badge>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              opportunity.paidStatus === 'Paid' 
                ? "border-[#00FF87]/50 text-[#00FF87]" 
                : "border-muted text-muted-foreground"
            )}
          >
            <DollarSign className="w-3 h-3 mr-0.5" />
            {opportunity.paidStatus}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {opportunity.unionStatus}
          </Badge>
          {opportunity.isRemote && (
            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-500">
              Remote
            </Badge>
          )}
        </div>
        
        {/* Role tags */}
        <div className="flex flex-wrap gap-1">
          {opportunity.roleTags.map(role => (
            <span 
              key={role}
              className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary text-secondary-foreground"
            >
              {role}
            </span>
          ))}
        </div>
        
        {/* Meta info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            {!opportunity.isRemote && opportunity.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {opportunity.location.split(',')[0]}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {opportunity.applicantCount}
            </span>
          </div>
          <span className={cn(
            "flex items-center gap-1 font-medium",
            isUrgent && "text-orange-500"
          )}>
            <Clock className="w-3.5 h-3.5" />
            {deadlineText}
          </span>
        </div>
      </div>
    </article>
  );
};

export default OpportunityCard;
