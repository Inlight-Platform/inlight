import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { 
  MapPin, DollarSign, Clock, Users, Briefcase, Globe, Building2,
  CheckCircle2, Bookmark, BookmarkCheck, CalendarPlus, Pencil, Trash2
} from 'lucide-react';
import { useSavedItems } from '@/hooks/useSavedItems';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { OpportunityView } from '@/hooks/useOpportunities';
import ApplicationDialog from './ApplicationDialog';
import OpportunityDetailSheet from './OpportunityDetailSheet';
import EditOpportunityDialog from './EditOpportunityDialog';

interface OpportunityCardProps {
  opportunity: OpportunityView;
  compact?: boolean;
}

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

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, compact = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSaved, toggleSave } = useSavedItems();
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [hasAppliedDB, setHasAppliedDB] = useState(false);
  const [posterProfile, setPosterProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    user_id: string;
  } | null>(null);
  
  const isDeadlinePast = opportunity.deadline ? isPast(new Date(opportunity.deadline)) : false;
  const hasApplied = hasAppliedDB;

  // Fetch poster profile
  useEffect(() => {
    const fetchPosterProfile = async () => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunity.postedBy);
      if (!isUUID) return;

      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, user_id')
        .eq('user_id', opportunity.postedBy)
        .maybeSingle();
      
      if (data) setPosterProfile(data);
    };
    fetchPosterProfile();
  }, [opportunity.postedBy]);
  
  // Check if user has applied
  useEffect(() => {
    const checkApplication = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('opportunity_applications')
        .select('id')
        .eq('opportunity_id', opportunity.id)
        .eq('applicant_id', user.id)
        .maybeSingle();
      setHasAppliedDB(!!data);
    };
    checkApplication();
  }, [user, opportunity.id]);
  
  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunity.actionType === 'calendar') {
      handleAddToCalendar(e);
    } else {
      setShowApplicationDialog(true);
    }
  };

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const title = encodeURIComponent(opportunity.title);
    const details = encodeURIComponent(opportunity.description);
    const location = encodeURIComponent(opportunity.isRemote ? 'Remote' : (opportunity.location || ''));
    const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : new Date();
    const dateStr = deadlineDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    // Use end time if available, otherwise default to 2 hours after start
    let endDate: Date;
    if (opportunity.startDate && opportunity.deadline) {
      const baseDateStr = opportunity.deadline.split('T')[0];
      endDate = new Date(`${baseDateStr}T${opportunity.startDate}`);
    } else {
      endDate = new Date(deadlineDate.getTime() + 2 * 60 * 60 * 1000);
    }
    const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dateStr}/${endStr}`;
    window.open(calUrl, '_blank');
  };

  const handleApplicationSubmitted = () => {
    setHasAppliedDB(true);
  };

  if (compact) {
    return (
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${opportunityTypeColors[opportunity.type]}`}>
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{opportunity.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {opportunity.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{opportunity.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {opportunity.isRemote ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                  {opportunity.isRemote ? 'Remote' : opportunity.location}
                </span>
              </div>
              {opportunity.compensation && (
                <div className="flex items-center gap-1 text-sm text-primary mt-1">
                  <DollarSign className="w-3 h-3" />{opportunity.compensation}
                </div>
              )}
            </div>
            <Badge variant="outline" className={opportunityTypeColors[opportunity.type]}>
              {opportunity.type}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/30 cursor-pointer" onClick={() => setShowDetailSheet(true)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={opportunityTypeColors[opportunity.type]}>
                {opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
              </Badge>
              {opportunity.status === 'closed' && <Badge variant="destructive">Closed</Badge>}
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">{opportunity.title}</h3>
            {opportunity.company && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Building2 className="w-4 h-4" />{opportunity.company}
              </p>
            )}
          </div>
          {posterProfile && (
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
              onClick={(e) => { e.stopPropagation(); navigate(`/profile/${posterProfile.user_id}`); }}
            >
              <div className="text-right">
                <p className="text-sm font-medium">{posterProfile.display_name}</p>
              </div>
              <Avatar className="h-10 w-10 border-2 border-border">
                <AvatarImage src={posterProfile.avatar_url || undefined} />
                <AvatarFallback>{posterProfile.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-muted-foreground line-clamp-3">{opportunity.description}</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            {opportunity.isRemote ? <Globe className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            <span>{opportunity.isRemote ? 'Remote' : opportunity.location}</span>
          </div>
          {opportunity.compensation && (
            <div className="flex items-center gap-2 text-primary font-medium">
              <DollarSign className="w-4 h-4" /><span>{opportunity.compensation}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="w-4 h-4" />
            <span>{experienceLevelLabels[opportunity.experienceLevel] || 'Any Level'}</span>
          </div>
        </div>
        
        {opportunity.deadline && (
          <div className={`flex items-center gap-2 text-sm ${isDeadlinePast ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-4 h-4" />
            <span>
              {isDeadlinePast 
                ? 'Deadline passed' 
                : (() => {
                    const dl = opportunity.deadline!;
                    const hasTime = dl.includes('T');
                    const dateFormatted = format(new Date(dl), hasTime ? 'MMM d, yyyy' : 'MMM d, yyyy');
                    const startFormatted = hasTime ? format(new Date(dl), 'h:mm a') : '';
                    const endFormatted = opportunity.startDate ? format(new Date(`2000-01-01T${opportunity.startDate}`), 'h:mm a') : '';
                    if (startFormatted && endFormatted) return `${dateFormatted} · ${startFormatted} – ${endFormatted}`;
                    if (startFormatted) return `${dateFormatted} · ${startFormatted}`;
                    return `Apply by ${dateFormatted}`;
                  })()}
            </span>
          </div>
        )}
        
        {opportunity.roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opportunity.roles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
            ))}
          </div>
        )}
        
        {opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opportunity.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">#{tag}</Badge>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Posted {formatDistanceToNow(new Date(opportunity.createdAt), { addSuffix: true })}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSave({
                  item_type: 'job',
                  item_title: opportunity.title,
                  item_metadata: {
                    company: opportunity.company,
                    type: opportunity.type,
                    location: opportunity.isRemote ? 'Remote' : opportunity.location,
                    description: opportunity.description?.slice(0, 200),
                    compensation: opportunity.compensation,
                  },
                });
              }}
              className="p-1 rounded-full hover:bg-accent transition-colors"
            >
              {isSaved('job', opportunity.title) ? (
                <BookmarkCheck className="w-4 h-4 text-primary" />
              ) : (
                <Bookmark className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {user && user.id === opportunity.postedBy && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowEditDialog(true); }}
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
              onClick={handleAddToCalendar}
              className="gap-1.5"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Calendar
            </Button>
          ) : hasApplied ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-500 font-medium">Applied</span>
            </div>
          ) : (
            <Button 
              size="sm"
              disabled={isDeadlinePast || opportunity.status !== 'open'}
              onClick={handleApply}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>

      <ApplicationDialog
        open={showApplicationDialog}
        onOpenChange={setShowApplicationDialog}
        opportunityId={opportunity.id}
        opportunityTitle={opportunity.title}
        onApplicationSubmitted={handleApplicationSubmitted}
      />

      <OpportunityDetailSheet
        opportunity={opportunity}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        posterProfile={posterProfile}
        hasApplied={hasApplied}
        onApply={() => { setShowDetailSheet(false); setShowApplicationDialog(true); }}
        onEdit={user && user.id === opportunity.postedBy ? () => { setShowDetailSheet(false); setShowEditDialog(true); } : undefined}
      />

      <EditOpportunityDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        opportunity={opportunity}
      />
    </Card>
  );
};

export default OpportunityCard;
