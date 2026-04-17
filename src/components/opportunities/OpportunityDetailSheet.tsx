import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  MapPin, DollarSign, Clock, Users, Briefcase, Globe, Building2, CheckCircle2, CalendarPlus, Pencil, ExternalLink
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { OpportunityView } from '@/hooks/useOpportunities';

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

  if (!opportunity) return null;

  const isDeadlinePast = opportunity.deadline ? isPast(new Date(opportunity.deadline)) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {opportunity.imageUrl && (
          <div className="w-full aspect-video bg-muted overflow-hidden rounded-lg mb-4 -mt-2">
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
              onClick={() => { onOpenChange(false); navigate(`/profile/${posterProfile.user_id}`); }}
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
                    const hasTime = dl.includes('T');
                    const dateFormatted = format(new Date(dl), 'MMM d, yyyy');
                    const startFormatted = hasTime ? format(new Date(dl), 'h:mm a') : '';
                    const endFormatted = opportunity.startDate ? format(new Date(`2000-01-01T${opportunity.startDate}`), 'h:mm a') : '';
                    if (startFormatted && endFormatted) return `${dateFormatted} · ${startFormatted} – ${endFormatted}`;
                    if (startFormatted) return `${dateFormatted} · ${startFormatted}`;
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
                const title = encodeURIComponent(opportunity.title);
                const details = encodeURIComponent(opportunity.description);
                const loc = encodeURIComponent(opportunity.isRemote ? 'Remote' : (opportunity.location || ''));
                const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : new Date();
                const dateStr = deadlineDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                let endDate: Date;
                if (opportunity.startDate && opportunity.deadline) {
                  const baseDateStr = opportunity.deadline.split('T')[0];
                  endDate = new Date(`${baseDateStr}T${opportunity.startDate}`);
                } else {
                  endDate = new Date(deadlineDate.getTime() + 2 * 60 * 60 * 1000);
                }
                const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${loc}&dates=${dateStr}/${endStr}`;
                window.open(calUrl, '_blank');
              }}
              className="gap-1.5"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Calendar
            </Button>
          ) : opportunity.actionType === 'external' ? (
            <Button
              size="sm"
              asChild
              disabled={isDeadlinePast || opportunity.status !== 'open' || !opportunity.linkUrl}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <a
                href={opportunity.linkUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
                {opportunity.linkTitle || 'Apply Externally'}
              </a>
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
              onClick={(e) => { e.stopPropagation(); onApply(); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Now
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OpportunityDetailSheet;
