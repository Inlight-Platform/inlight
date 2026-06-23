import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Loader2, Clock } from 'lucide-react';
import { useVerificationRequests } from '@/hooks/useCreditVerification';
import { toast } from 'sonner';

interface Credit {
  id: string;
  project: string;
  role: string;
  year: number;
  company: string | null;
  verified: boolean;
}

interface VerifyCreditsDialogProps {
  credits: Credit[];
}

export const VerifyCreditsDialog: React.FC<VerifyCreditsDialogProps> = ({ credits }) => {
  const { myRequests, submitRequest, isSubmitting } = useVerificationRequests();
  const [open, setOpen] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Filter to unverified credits that don't have pending requests
  const pendingRequestCreditIds = myRequests
    .filter(r => r.status === 'pending')
    .map(r => r.credit_id);

  const unverifiedCredits = credits.filter(
    c => !c.verified && !pendingRequestCreditIds.includes(c.id)
  );

  const handleSubmit = async () => {
    if (selectedCredits.length === 0) {
      toast.error('Please select at least one credit to verify');
      return;
    }

    // Submit a request for each selected credit
    for (const creditId of selectedCredits) {
      submitRequest({
        creditId,
        materialsUrls: [],
        notes,
      });
    }

    toast.success('Verification request submitted! Our team will review it shortly.');
    setSelectedCredits([]);
    setNotes('');
    setOpen(false);
  };

  const toggleCredit = (creditId: string) => {
    setSelectedCredits(prev =>
      prev.includes(creditId)
        ? prev.filter(id => id !== creditId)
        : [...prev, creditId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          <ShieldCheck className="w-4 h-4 mr-2" />
          Verify Credits
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-lg"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Submit Credits for Verification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credits selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Select the credits you'd like to verify. An admin will review your request.
            </p>

            {unverifiedCredits.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                All your credits are either verified or have pending verification requests.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unverifiedCredits.map(credit => (
                  <label
                    key={credit.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedCredits.includes(credit.id)}
                      onCheckedChange={() => toggleCredit(credit.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{credit.project}</p>
                      <p className="text-sm text-muted-foreground">
                        {credit.role} • {credit.year}
                        {credit.company && ` • ${credit.company}`}
                      </p>
                    </div>
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Pending requests info */}
          {pendingRequestCreditIds.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                You have {pendingRequestCreditIds.length} credit(s) pending verification review.
              </p>
            </div>
          )}

          {/* File upload */}
          {unverifiedCredits.length > 0 && (
            <>
              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">Additional Notes</label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional context about your credits..."
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={selectedCredits.length === 0 || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Submit for Verification
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
