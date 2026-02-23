import React, { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AcceptApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantName: string;
  roleName: string;
  projectName: string;
  isPending: boolean;
  onConfirm: (welcomeMessage: string) => void;
}

export const AcceptApplicationDialog: React.FC<AcceptApplicationDialogProps> = ({
  open,
  onOpenChange,
  applicantName,
  roleName,
  projectName,
  isPending,
  onConfirm,
}) => {
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const handleConfirm = () => {
    onConfirm(welcomeMessage);
    setWelcomeMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Accept Application</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            You are about to accept <strong>{applicantName}</strong> onto your team! They will have access to any private links on this project, and will appear as a team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Would you like to send a welcome message and proceed?
          </p>

          <div className="space-y-2">
            <Label htmlFor="welcome-message">Welcome Message</Label>
            <Textarea
              id="welcome-message"
              placeholder={`Welcome aboard, ${applicantName}! Excited to have you on the team...`}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be sent as a direct message. They'll also receive an email notification about being accepted.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Accept & Send
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
