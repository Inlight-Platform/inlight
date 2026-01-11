import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { 
  MapPin, 
  DollarSign, 
  Clock, 
  Users, 
  Briefcase, 
  Star,
  Calendar,
  CheckCircle2,
  Globe,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Opportunity, useStore } from '@/store/useStore';

interface OpportunityCardProps {
  opportunity: Opportunity;
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
  senior: 'Senior',
  any: 'Any Level',
};

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, compact = false }) => {
  const navigate = useNavigate();
  const { getUser, currentUserId } = useStore();
  const poster = getUser(opportunity.postedBy);
  
  const isDeadlinePast = opportunity.deadline ? isPast(new Date(opportunity.deadline)) : false;
  const hasApplied = opportunity.applicants.some(a => a.userId === currentUserId);
  const applicationStatus = opportunity.applicants.find(a => a.userId === currentUserId)?.status;
  
  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { opportunities } = useStore.getState();
    useStore.setState({
      opportunities: opportunities.map(o => 
        o.id === opportunity.id 
          ? {
              ...o,
              applicants: [...o.applicants, {
                userId: currentUserId,
                appliedAt: new Date().toISOString(),
                status: 'pending' as const
              }]
            }
          : o
      )
    });
  };

  if (compact) {
    return (
      <Card 
        className="hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/30"
        onClick={() => {}}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div 
              className={`p-2 rounded-lg ${opportunityTypeColors[opportunity.type]}`}
            >
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{opportunity.title}</h3>
                {opportunity.isFeatured && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {opportunity.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {opportunity.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {opportunity.isRemote ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                  {opportunity.isRemote ? 'Remote' : opportunity.location}
                </span>
              </div>
              {opportunity.compensation && (
                <div className="flex items-center gap-1 text-sm text-primary mt-1">
                  <DollarSign className="w-3 h-3" />
                  {opportunity.compensation}
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
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={opportunityTypeColors[opportunity.type]}>
                {opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
              </Badge>
              {opportunity.isFeatured && (
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
              {opportunity.status === 'closed' && (
                <Badge variant="destructive">Closed</Badge>
              )}
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">{opportunity.title}</h3>
            {opportunity.company && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {opportunity.company}
              </p>
            )}
          </div>
          {poster && (
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${poster.id}`);
              }}
            >
              <Avatar className="h-10 w-10 border-2 border-border">
                <AvatarImage src={poster.avatar} alt={poster.name} />
                <AvatarFallback>{poster.name[0]}</AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-sm font-medium">{poster.name}</p>
                <p className="text-xs text-muted-foreground">{poster.role}</p>
              </div>
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
              <DollarSign className="w-4 h-4" />
              <span>{opportunity.compensation}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="w-4 h-4" />
            <span>{experienceLevelLabels[opportunity.experienceLevel]}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{opportunity.applicants.length} applicant{opportunity.applicants.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        {opportunity.deadline && (
          <div className={`flex items-center gap-2 text-sm ${isDeadlinePast ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-4 h-4" />
            <span>
              {isDeadlinePast 
                ? 'Deadline passed' 
                : `Apply by ${format(new Date(opportunity.deadline), 'MMM d, yyyy')}`
              }
            </span>
          </div>
        )}
        
        {opportunity.roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opportunity.roles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
        )}
        
        {opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opportunity.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                #{tag}
              </Badge>
            ))}
            {opportunity.tags.length > 5 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{opportunity.tags.length - 5} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Posted {formatDistanceToNow(new Date(opportunity.createdAt), { addSuffix: true })}
          </span>
          
          {hasApplied ? (
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
              onClick={handleApply}
              className="bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
            >
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OpportunityCard;
