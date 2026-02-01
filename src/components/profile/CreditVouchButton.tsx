import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, Check, Loader2, Users } from 'lucide-react';
import { useCreditVouches } from '@/hooks/useCreditVerification';

interface CreditVouchButtonProps {
  creditId: string;
  canVouch: boolean;
  isVerified: boolean;
}

export const CreditVouchButton: React.FC<CreditVouchButtonProps> = ({
  creditId,
  canVouch,
  isVerified,
}) => {
  const { hasVouched, vouchCount, vouch, unvouch, isPending } = useCreditVouches(creditId);

  if (isVerified) {
    return (
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Check className="w-4 h-4" />
        <span className="text-xs font-medium">Verified</span>
      </div>
    );
  }

  if (!canVouch) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-xs">{vouchCount}/2</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Team members can vouch for credits (need {2 - vouchCount} more)</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant={hasVouched ? "default" : "outline"}
          className={`h-7 px-2 text-xs ${hasVouched ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          onClick={() => hasVouched ? unvouch() : vouch()}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <ShieldCheck className="w-3 h-3 mr-1" />
          )}
          {hasVouched ? 'Vouched' : 'Vouch'}
          <span className="ml-1 opacity-70">({vouchCount}/2)</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hasVouched ? 'Remove your vouch for this credit' : 'Vouch to help verify this credit'}</p>
        <p className="text-xs text-muted-foreground">2 team vouches = verified</p>
      </TooltipContent>
    </Tooltip>
  );
};
