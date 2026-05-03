import React, { useState } from 'react';
import { useEventRsvps } from '@/hooks/useEventRsvps';
import { ChevronDown, ChevronUp, Shield, Mail, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EventAdminPanelProps {
  eventId: string;
}

const EventAdminPanel: React.FC<EventAdminPanelProps> = ({ eventId }) => {
  const { rsvps, goingCount, cantMakeItCount } = useEventRsvps(eventId, { includePrivate: true });
  const [open, setOpen] = useState(false);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  const goingRsvps = rsvps.filter(r => r.status === 'going');
  const cantMakeItRsvps = rsvps.filter(r => r.status === 'cant_make_it');

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Admin</span>
          <Badge variant="secondary" className="text-xs">{rsvps.length} responses</Badge>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Summary */}
          <div className="flex gap-4 p-4 bg-muted/30">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-primary">{goingCount}</p>
              <p className="text-xs text-muted-foreground">Going</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-muted-foreground">{cantMakeItRsvps.length}</p>
              <p className="text-xs text-muted-foreground">Can't Make It</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-foreground">{rsvps.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          {/* Going section */}
          {goingRsvps.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-primary/5 border-y border-border">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Going ({goingRsvps.length})</p>
              </div>
              <div className="divide-y divide-border">
                {goingRsvps.map((rsvp) => (
                  <RsvpRow key={rsvp.id} rsvp={rsvp} formatDate={formatDate} />
                ))}
              </div>
            </div>
          )}

          {/* Can't Make It section */}
          {cantMakeItRsvps.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-muted/50 border-y border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Can't Make It ({cantMakeItRsvps.length})</p>
              </div>
              <div className="divide-y divide-border">
                {cantMakeItRsvps.map((rsvp) => (
                  <RsvpRow key={rsvp.id} rsvp={rsvp} formatDate={formatDate} />
                ))}
              </div>
            </div>
          )}

          {rsvps.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No responses yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

interface RsvpRowProps {
  rsvp: {
    id: string;
    name: string;
    email?: string | null;
    role_type: string;
    status: string;
    created_at: string;
    custom_answer?: string | null;
  };
  formatDate: (d: string) => string;
}

const RsvpRow: React.FC<RsvpRowProps> = ({ rsvp, formatDate }) => (
  <div className="px-4 py-3 space-y-1">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{rsvp.name}</span>
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            rsvp.role_type === 'actor'
              ? 'border-rose-400/40 text-rose-400'
              : 'border-cyan-400/40 text-cyan-400'
          )}
        >
          {rsvp.role_type === 'actor' ? 'Actor' : 'Filmmaker'}
        </Badge>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Mail className="w-3 h-3" />
      {rsvp.email ? (
        <a href={`mailto:${rsvp.email}`} className="hover:text-foreground transition-colors underline">
          {rsvp.email}
        </a>
      ) : (
        <span className="italic">email hidden</span>
      )}
    </div>
    {(rsvp as any).custom_answer && (
      <p className="text-xs text-muted-foreground italic pl-5">"{(rsvp as any).custom_answer}"</p>
    )}
    <div className="flex items-center gap-1 text-xs text-muted-foreground pl-5">
      <Clock className="w-3 h-3" />
      <span>{formatDate(rsvp.created_at)}</span>
    </div>
  </div>
);

export default EventAdminPanel;
