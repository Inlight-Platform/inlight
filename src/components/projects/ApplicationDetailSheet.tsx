import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, FileText, User, Clock, Check, X, Video, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

interface ApplicationDetail {
  id: string;
  project_role_id: string;
  applicant_id: string;
  message: string;
  reel_url: string | null;
  resume_url: string | null;
  include_profile?: boolean;
  status: string;
  created_at: string;
  applicant_profile?: {
    display_name: string | null;
    avatar_url: string | null;
    headline?: string | null;
    role?: string | null;
  };
  role_name?: string;
}

interface ApplicationDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ApplicationDetail | null;
  onAccept?: (applicationId: string, applicantId: string, roleName: string) => void;
  onDecline?: (applicationId: string) => void;
  isCreator: boolean;
}

export const ApplicationDetailSheet: React.FC<ApplicationDetailSheetProps> = ({
  open,
  onOpenChange,
  application,
  onAccept,
  onDecline,
  isCreator,
}) => {
  const navigate = useNavigate();

  if (!application) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case 'accepted':
        return <Badge className="gap-1 bg-green-500"><Check className="w-3 h-3" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><X className="w-3 h-3" />Declined</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Application Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Applicant info */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${application.applicant_id}`)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={application.applicant_profile?.avatar_url || undefined} />
                <AvatarFallback>
                  {application.applicant_profile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold hover:underline">
                  {application.applicant_profile?.display_name || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {application.applicant_profile?.headline || application.applicant_profile?.role || 'Inlight Member'}
                </p>
              </div>
            </div>
            {getStatusBadge(application.status)}
          </div>

          <Separator />

          {/* Role applied for */}
          {application.role_name && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Applied for</p>
              <p className="font-medium">{application.role_name}</p>
            </div>
          )}

          {/* Submitted date */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Submitted</p>
            <p className="text-sm">
              {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
            </p>
          </div>

          <Separator />

          {/* Message */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Cover Letter / Message</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {application.message || 'No message provided.'}
            </p>
          </div>

          {/* Links */}
          {(application.reel_url || application.resume_url) && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Attachments</p>
                {application.reel_url && (
                  <a
                    href={application.reel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Video className="w-4 h-4" />
                    Reel / Portfolio
                  </a>
                )}
                {application.resume_url && (
                  <a
                    href={application.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    Download Resume
                  </a>
                )}
              </div>
            </>
          )}

          {/* Profile included */}
          {application.include_profile && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Inlight Profile</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/profile/${application.applicant_id}`)}
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  View Full Profile
                </Button>
              </div>
            </>
          )}

          {/* Actions for creator */}
          {isCreator && application.status === 'pending' && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => onAccept?.(application.id, application.applicant_id, application.role_name || '')}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onDecline?.(application.id)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
