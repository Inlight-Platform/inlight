import React from 'react';
import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Company } from '@/hooks/useCompanyFollows';

interface CompanyCardProps {
  company: Company;
  isFollowing: boolean;
  onFollow: (companyId: string) => void;
  onUnfollow: (companyId: string) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, isFollowing, onFollow, onUnfollow }) => {
  return (
    <Card className="overflow-hidden">
      {/* Header gradient */}
      <div 
        className="h-20 w-full"
        style={{
          background: 'linear-gradient(135deg, hsl(200 80% 50%), hsl(220 70% 45%))',
        }}
      />
      <CardContent className="pt-0 pb-5 px-5 text-center -mt-8">
        <div className="w-16 h-16 rounded-xl bg-card border-4 border-background flex items-center justify-center mx-auto mb-3 shadow-md">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-full h-full rounded-lg object-cover" />
          ) : (
            <Building2 className="w-7 h-7 text-primary" />
          )}
        </div>
        <h3 className="font-display font-semibold text-base mb-1">{company.name}</h3>
        {company.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{company.description}</p>
        )}
        {company.location && (
          <p className="text-xs text-muted-foreground mb-3">{company.location}</p>
        )}
        <Button
          variant={isFollowing ? 'outline' : 'default'}
          size="sm"
          className="w-full rounded-full"
          onClick={() => isFollowing ? onUnfollow(company.id) : onFollow(company.id)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CompanyCard;
