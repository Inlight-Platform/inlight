import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Award, Loader2 } from 'lucide-react';

interface VouchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => void;
  isPending: boolean;
  targetName?: string;
}

export const VouchDialog: React.FC<VouchDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  targetName,
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    onSubmit(message.trim());
    setMessage('');
  };

  const handleClose = () => {
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Vouch for {targetName || 'this person'}
          </DialogTitle>
          <DialogDescription>
            Your vouch helps build their reputation in the community.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Why are you vouching for this person?
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leaving a review helps their reputation."
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {message.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Vouching...
              </>
            ) : (
              <>
                <Award className="w-4 h-4 mr-2" />
                Vouch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
