import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  MapPin, DollarSign, Clock, Users, Briefcase, Globe, Building2, CheckCircle2, CalendarPlus, Pencil, ExternalLink, X
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { OpportunityView } from '@/hooks/useOpportunities';
import { buildOpportunityCalendarUrl, parseOpportunityDate } from '@/lib/opportunityCalendar';
import { useAuth } from '@/hooks/useAuth';
import { VisitorAuthPrompt } from '@/components/auth/VisitorAuthPrompt';

const opportunityTypeColors: Record<string, string> = {
  job: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  casting: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gig: 'bg-green-500/20 text-green-400 border-green-500/30',
  collaboration: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const experienceLevelLabels: Record<string, string> = {
  entry: 'Entry Level',
  intermediate: 'Intermediate',
  senior: 'Professional',
  any: 'Any Level',
};

interface OpportunityDetailSheetProps {
  opportunity: OpportunityView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posterProfile: {
    display_name: string | null;
    avatar_url: string | null;
    user_id: string;
  } | null;
  hasApplied: boolean;
  applicationStatus?: string;
  onApply: () => void;
  onEdit?: () => void;
}

const OpportunityDetailSheet: React.FC<OpportunityDetailSheetProps> = ({
  opportunity, open, onOpenChange, posterProfile, hasApplied, applicationStatus, onApply, onEdit
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showVisitorAuthPrompt, setShowVisitorAuthPrompt] = useState(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowVisitorAuthPrompt(false);
    }
    onOpenChange(nextOpen);
  };

  const handleOverlayClose = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleOpenChange(false);
  };

  const closeVisitorAuthPromptAndDrawer = () => {
    handleOpenChange(false);
  };

  useEffect(() => {
    if (!open || !opportunity) return;

    const getClientPoint = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if ('touches' in event) {
        const touch = event.touches[0] ?? event.changedTouches[0];
        return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
      }

      return { clientX: event.clientX, clientY: event.clientY };
    };

    const handleOutsidePress = (event: PointerEvent | MouseEvent | TouchEvent) => {
      const content = sheetContentRef.current;
      if (!content) return;

      const point = getClientPoint(event);
      if (!point) return;

      const rect = content.getBoundingClientRect();
      const pointerIsInsideDrawer =
        point.clientX >= rect.left &&
        point.clientX <= rect.right &&
        point.clientY >= rect.top &&
        point.clientY <= rect.bottom;

      if (!pointerIsInsideDrawer) {
        setShowVisitorAuthPrompt(false);
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePress, true);
    document.addEventListener('mousedown', handleOutsidePress, true);
    document.addEventListener('touchstart', handleOutsidePress, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePress, true);
      document.removeEventListener('mousedown', handleOutsidePress, true);
      document.removeEventListener('touchstart', handleOutsidePress, true);
    };
  }, [open, opportunity, onOpenChange]);

  if (!opportunity) return null;

  const deadlineDate = parseOpportunityDate(opportunity.deadline);
  const isDeadlinePast = deadlineDate ? isPast(deadlineDate) : false;
  const calendarUrl = opportunity.actionType === 'calendar'
    ? buildOpportunityCalendarUrl(opportunity)
    : null;
  const hasUsableExternalLink = (() => {
    if (!opportunity.linkUrl) return false;

    try {
      const parsed = new URL(opportunity.linkUrl);
      const host = parsed.hostname.toLowerCase();
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !host.includes('inlight') &&
        host !== 'localhost' &&
        host !== '127.0.0.1'
      );
    } catch {
      return false;
    }
  })();

  const visitorAuthOverlay = showVisitorAuthPrompt
    ? createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-background/45 px-4 py-8 backdrop-blur-md sm:px-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVisitorAuthPromptAndDrawer();
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeVisitorAuthPromptAndDrawer();
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeVisitorAuthPromptAndDrawer();
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) closeVisitorAuthPromptAndDrawer();
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 rounded-full bg-card/90 text-foreground shadow-lg hover:bg-card"
            onClick={closeVisitorAuthPromptAndDrawer}
            aria-label="Close sign in prompt"
          >
            <X className="h-4 w-4" />
          </Button>
          <VisitorAuthPrompt
            compact
            title="Apply on Inlight"
            description="Sign in or create an account to apply."
            features={['Internal application', 'Creator profile', 'Application tracking']}
            restore={{ type: 'opportunity', id: opportunity.id }}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        ref={sheetContentRef}
        className="z-[90] w-full border-l border-border bg-card text-card-foreground shadow-2xl sm:max-w-lg overflow-y-auto"
        overlayProps={{
          onClick: handleOverlayClose,
          onMouseDown: handleOverlayClose,
          onPointerDown: handleOverlayClose,
          onTouchStart: handleOverlayClose,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-4 flex items-center justify-between border-b border-border bg-card/95 px-6 py-3 backdrop-blur">
          <span className="text-sm font-medium text-muted-foreground">Job details</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
        {opportunity.imageUrl && (
          <div className="w-full aspect-video bg-muted overflow-hidden rounded-lg mb-4">
            <img src={opportunity.imageUrl} alt={opportunity.title} className="w-full h-full object-cover" />
          </div>
        )}
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={opportunityTypeColors[opportunity.type]}>
              {opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
            </Badge>
            {opportunity.status === 'closed' && <Badge variant="destructive">Closed</Badge>}
          </div>
          <SheetTitle className="text-xl">{opportunity.title}</SheetTitle>
          {opportunity.company && (
            <SheetDescription className="flex items-center gap-1.5 text-sm">
              <Building2 className="w-4 h-4" />{opportunity.company}
            </SheetDescription>
          )}
        </SheetHeader>

        {posterProfile && (
          <>
            <div
              className="flex items-center gap-3 py-3 cursor-pointer hover:opacity-80"
              onClick={() => { handleOpenChange(false); navigate(`/profile/${posterProfile.user_id}`); }}
            >
              <Avatar className="h-10 w-10 border-2 border-border">
                <AvatarImage src={posterProfile.avatar_url || undefined} />
                <AvatarFallback>{posterProfile.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{posterProfile.display_name}</p>
                <p className="text-xs text-muted-foreground">Posted by</p>
              </div>
            </div>
            <Separator />
          </>
        )}

        <div className="grid grid-cols-2 gap-3 py-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            {opportunity.isRemote ? <Globe className="w-4 h-4 flex-shrink-0" /> : <MapPin className="w-4 h-4 flex-shrink-0" />}
            <span>{opportunity.isRemote ? 'Remote' : opportunity.location}</span>
          </div>
          {opportunity.compensation && (
            <div className="flex items-center gap-2 text-primary font-medium">
              <DollarSign className="w-4 h-4 flex-shrink-0" /><span>{opportunity.compensation}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="w-4 h-4 flex-shrink-0" />
            <span>{experienceLevelLabels[opportunity.experienceLevel] || 'Any Level'}</span>
          </div>
        </div>

        {opportunity.deadline && (
          <div className={`flex items-center gap-2 text-sm pb-4 ${isDeadlinePast ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-4 h-4" />
            <span>
              {isDeadlinePast 
                ? 'Deadline passed' 
                : (() => {
                    const dl = opportunity.deadline!;
                    const dlDate = new Date(dl);
                    if (isNaN(dlDate.getTime())) return 'Date TBD';
                    const hasTime = dl.includes('T');
                    const dateFormatted = format(dlDate, 'MMM d, yyyy');
                    const startDate = opportunity.startDate ? new Date(opportunity.startDate) : null;
                    const startValid = startDate && !isNaN(startDate.getTime());
                    const startFormatted = startValid ? format(startDate!, 'h:mm a') : '';
                    const endFormatted = hasTime ? format(dlDate, 'h:mm a') : '';
                    if (startFormatted && endFormatted) return `${dateFormatted} · ${startFormatted} – ${endFormatted}`;
                    if (startFormatted) return `${dateFormatted} · ${startFormatted}`;
                    if (endFormatted) return `${dateFormatted} · ${endFormatted}`;
                    return `Apply by ${dateFormatted}`;
                  })()}
            </span>
          </div>
        )}

        <Separator />

        <div className="py-4">
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opportunity.description}</p>
        </div>

        {opportunity.roles.length > 0 && (
          <>
            <Separator />
            <div className="py-4">
              <h3 className="text-sm font-semibold mb-2">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {opportunity.roles.map((role) => (
                  <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {opportunity.tags.length > 0 && (
          <>
            <Separator />
            <div className="py-4">
              <h3 className="text-sm font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">#{tag}</Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {opportunity.linkUrl && opportunity.actionType !== 'external' && (
          <>
            <Separator />
            <div className="py-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={(e) => { e.stopPropagation(); window.open(opportunity.linkUrl, '_blank', 'noopener,noreferrer'); }}
              >
                <ExternalLink className="w-4 h-4" />
                {opportunity.linkTitle || 'Visit Link'}
              </Button>
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Posted {formatDistanceToNow(new Date(opportunity.createdAt), { addSuffix: true })}
            </span>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                title="Edit opportunity"
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {opportunity.actionType === 'calendar' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                if (!calendarUrl) return;
                window.open(calendarUrl, '_blank', 'noopener,noreferrer');
              }}
              disabled={!calendarUrl}
              className="gap-1.5"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Calendar
            </Button>
          ) : opportunity.actionType === 'external' && hasUsableExternalLink ? (
            <Button
              size="sm"
              asChild
              disabled={isDeadlinePast || opportunity.status !== 'open'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <a
                href={opportunity.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                {opportunity.linkTitle || 'Apply Externally'}
              </a>
            </Button>
          ) : opportunity.actionType === 'external' ? (
            <Button
              size="sm"
              disabled
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              Apply link unavailable
            </Button>
          ) : hasApplied ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-500 font-medium">
                {applicationStatus === 'accepted' ? 'Accepted!' :
                 applicationStatus === 'reviewed' ? 'Under Review' :
                 applicationStatus === 'rejected' ? 'Not Selected' : 'Applied'}
              </span>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={isDeadlinePast || opportunity.status !== 'open'}
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  setShowVisitorAuthPrompt(true);
                  return;
                }
                onApply();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Now
            </Button>
          )}
        </div>

      </SheetContent>
      {visitorAuthOverlay}
    </Sheet>
  );
};

export default OpportunityDetailSheet;
