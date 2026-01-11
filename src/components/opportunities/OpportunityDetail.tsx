import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Users, Bookmark, Share2, DollarSign, Building, ExternalLink, CheckCircle } from 'lucide-react';
import { Opportunity } from '@/store/opportunitiesStore';
import { useOpportunitiesStore } from '@/store/opportunitiesStore';
import { useStore } from '@/store/useStore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import ApplyModal from './ApplyModal';
import { cn } from '@/lib/utils';

interface OpportunityDetailProps {
  opportunity: Opportunity | null;
  open: boolean;
  onClose: () => void;
}

const OpportunityDetail: React.FC<OpportunityDetailProps> = ({ opportunity, open, onClose }) => {
  const { toggleBookmark, isBookmarked, hasApplied } = useOpportunitiesStore();
  const { currentUserId, getUser } = useStore();
  const { toast } = useToast();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [deadlineText, setDeadlineText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (!opportunity) return;
    
    const updateDeadline = () => {
      const deadline = new Date(opportunity.deadline);
      const now = new Date();
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      
      if (diffMs < 0) {
        setDeadlineText('Deadline passed');
      } else if (diffHours < 24) {
        setDeadlineText(`${diffHours} hours left`);
      } else if (diffDays === 1) {
        setDeadlineText('1 day left');
      } else {
        setDeadlineText(`${diffDays} days left`);
      }
    };
    
    updateDeadline();
    const interval = setInterval(updateDeadline, 1000 * 60 * 60); // Update every hour
    return () => clearInterval(interval);
  }, [opportunity]);
  
  if (!opportunity) return null;
  
  const bookmarked = isBookmarked(opportunity.id);
  const applied = hasApplied(opportunity.id, currentUserId);
  const poster = getUser(opportunity.posterUserId);
  
  const handleBookmark = () => {
    toggleBookmark(opportunity.id);
    toast({
      title: bookmarked ? 'Removed from saved' : 'Saved opportunity',
      duration: 2000,
    });
  };
  
  const handleShare = () => {
    navigator.clipboard.writeText(`https://inlight.app/opportunities/${opportunity.id}`);
    toast({
      title: 'Link copied',
      duration: 2000,
    });
  };
  
  const handleApply = () => {
    if (opportunity.applicationUrl) {
      window.open(opportunity.applicationUrl, '_blank');
    } else {
      setShowApplyModal(true);
    }
  };
  
  const content = (
    <>
      {/* Hero */}
      <div className="relative">
        {opportunity.coverImage && (
          <div className="relative h-48 md:h-56">
            <img 
              src={opportunity.coverImage} 
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>
        )}
        
        {/* Close button for sheet */}
        {isMobile && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {opportunity.logoURL && (
                <img 
                  src={opportunity.logoURL} 
                  alt={opportunity.companyName}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  {opportunity.title}
                </h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Building className="w-4 h-4" />
                  <span>{opportunity.companyName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span>Posted {new Date(opportunity.postedDate).toLocaleDateString()}</span>
                  <span className={cn(
                    "flex items-center gap-1 font-medium",
                    deadlineText.includes('hours') && "text-orange-500"
                  )}>
                    <Clock className="w-4 h-4" />
                    {deadlineText}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Badges row */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{opportunity.typeTag}</Badge>
              <Badge 
                variant="secondary" 
                className={cn(
                  opportunity.paidStatus === 'Paid' && "bg-[#00FF87]/20 text-[#00FF87]"
                )}
              >
                <DollarSign className="w-3 h-3 mr-1" />
                {opportunity.paidStatus}
              </Badge>
              <Badge variant="secondary">{opportunity.unionStatus}</Badge>
              {opportunity.isRemote && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                  Remote
                </Badge>
              )}
              {!opportunity.isRemote && opportunity.location && (
                <Badge variant="secondary">
                  <MapPin className="w-3 h-3 mr-1" />
                  {opportunity.location}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Poster info */}
          {poster && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <img 
                src={poster.avatar} 
                alt={poster.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium">Posted by {poster.name}</p>
                <p className="text-xs text-muted-foreground">{poster.role} • {poster.location}</p>
              </div>
            </div>
          )}
          
          {/* Description */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">About this opportunity</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {opportunity.description.split('\n\n').map((para, i) => {
                if (para.startsWith('**') && para.endsWith('**')) {
                  return <p key={i} className="font-semibold">{para.replace(/\*\*/g, '')}</p>;
                }
                return <p key={i}>{para}</p>;
              })}
            </div>
          </div>
          
          {/* Requirements */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Requirements</h3>
            <ul className="space-y-2">
              {opportunity.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-[#00FF87] mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Compensation */}
          {opportunity.paidStatus === 'Paid' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Compensation</h3>
              <div className="p-4 bg-[#00FF87]/10 border border-[#00FF87]/30 rounded-lg">
                {opportunity.compensation && (
                  <p className="text-sm text-foreground mb-2">{opportunity.compensation}</p>
                )}
                {opportunity.compensationMin && opportunity.compensationMax && (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-[#00FF87]">
                      ${opportunity.compensationMin.toLocaleString()} - ${opportunity.compensationMax.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {opportunity.compensationPer}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Applicant count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{opportunity.applicantCount} people have applied</span>
          </div>
        </div>
      </ScrollArea>
      
      {/* Sticky footer */}
      <div className="sticky bottom-0 p-4 bg-background border-t border-border flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBookmark}
          className={cn(
            bookmarked && "bg-[#00FF87]/20 border-[#00FF87] text-[#00FF87]"
          )}
          aria-pressed={bookmarked}
        >
          <Bookmark className={cn("w-5 h-5", bookmarked && "fill-current")} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleShare}
        >
          <Share2 className="w-5 h-5" />
        </Button>
        <Button
          onClick={handleApply}
          disabled={applied}
          className={cn(
            "flex-1 h-12 text-base font-semibold",
            applied 
              ? "bg-muted text-muted-foreground" 
              : "bg-[#00FF87] text-black hover:bg-[#00FF87]/90"
          )}
        >
          {applied ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              Applied
            </>
          ) : opportunity.applicationUrl ? (
            <>
              Apply Now
              <ExternalLink className="w-4 h-4 ml-2" />
            </>
          ) : (
            'Apply Now'
          )}
        </Button>
      </div>
      
      <ApplyModal
        opportunity={opportunity}
        open={showApplyModal}
        onClose={() => setShowApplyModal(false)}
      />
    </>
  );
  
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col">
          {content}
        </SheetContent>
      </Sheet>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{opportunity.title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default OpportunityDetail;
