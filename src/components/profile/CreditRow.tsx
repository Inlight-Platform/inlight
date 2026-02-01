import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Clock, Trash2 } from 'lucide-react';
import { CreditVouchButton } from './CreditVouchButton';
import { useCanVouchForCredit } from '@/hooks/useCreditVerification';

interface Credit {
  id: string;
  user_id: string;
  project: string;
  role: string;
  year: number;
  company: string | null;
  verified: boolean;
}

interface CreditRowProps {
  credit: Credit;
  isOwnProfile: boolean;
  onDelete: (creditId: string) => void;
}

export const CreditRow: React.FC<CreditRowProps> = ({ credit, isOwnProfile, onDelete }) => {
  const canVouch = useCanVouchForCredit(credit.user_id);

  return (
    <tr className="border-b border-border/50 hover:bg-muted/50 group">
      <td className="py-3 px-4 font-medium">{credit.project}</td>
      <td className="py-3 px-4">{credit.role}</td>
      <td className="py-3 px-4">{credit.year}</td>
      <td className="py-3 px-4">{credit.company || '-'}</td>
      <td className="py-3 px-4">
        {isOwnProfile ? (
          // On own profile, show verified badge or pending status
          credit.verified ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white" title="Verified Credit">
              <Check className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground" title="Pending verification">
              <Clock className="w-3.5 h-3.5" />
            </span>
          )
        ) : (
          // On other profiles, show vouch button if can vouch
          <CreditVouchButton
            creditId={credit.id}
            canVouch={canVouch}
            isVerified={credit.verified}
          />
        )}
      </td>
      {isOwnProfile && (
        <td className="py-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(credit.id)}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </td>
      )}
    </tr>
  );
};
