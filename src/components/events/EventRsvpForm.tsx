import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useEventRsvps } from '@/hooks/useEventRsvps';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, Users, ChevronDown, ChevronUp, Sparkles, PartyPopper, Ticket } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EventRsvpFormProps {
  eventId: string;
  customQuestion?: string | null;
  isPaid?: boolean;
  price?: number | null;
  currency?: string;
  stripePriceId?: string | null;
  paymentLinkUrl?: string | null;
}

const EventRsvpForm: React.FC<EventRsvpFormProps> = ({ eventId, customQuestion, isPaid, price, currency = 'usd', stripePriceId, paymentLinkUrl }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { rsvps, goingRsvps, goingCount, cantMakeItCount, submitRsvp } = useEventRsvps(eventId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleType, setRoleType] = useState('actor');
  const [customAnswer, setCustomAnswer] = useState('');
  const [status, setStatus] = useState<'going' | 'cant_make_it'>('going');
  const [showAttendees, setShowAttendees] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [buyingTicket, setBuyingTicket] = useState(false);

  // Check for ticket success from Stripe redirect
  const ticketStatus = searchParams.get('ticket');
  const hasTicketSuccess = ticketStatus === 'success';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Check if user already RSVP'd (any status — going or can't make it)
  const userRsvp = currentUserId ? rsvps.find(r => r.user_id === currentUserId) : null;
  const alreadyRsvpd = !!userRsvp || submitted;
  const alreadyGoing = (userRsvp?.status === 'going') || submitted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadyRsvpd) {
      toast.error("You've already RSVP'd to this event");
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (customQuestion && !customAnswer.trim()) {
      toast.error('Please answer the required question');
      return;
    }
    submitRsvp.mutate(
      {
        event_id: eventId,
        name: name.trim(),
        email: email.trim(),
        role_type: roleType,
        status,
        custom_answer: customAnswer.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(status === 'going' ? "You're on the list! 🎉" : 'Thanks for letting us know!');
          setSubmitted(true);
          setDialogOpen(false);
        },
        onError: (err: any) => {
          const msg = String(err?.message || err?.details || err?.code || err || '');
          console.error('RSVP error:', JSON.stringify(err));
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505') || err?.code === '23505') {
            toast.error("You've already RSVP'd to this event.");
            setSubmitted(true);
            setDialogOpen(false);
          } else {
            toast.error('Something went wrong. Try again.');
          }
        },
      }
    );
  };

  const handleBuyTicket = async () => {
    if (paymentLinkUrl) {
      // Auto-RSVP the logged-in user as "going"
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, email')
            .eq('user_id', user.id)
            .single();
          if (profile) {
            submitRsvp.mutate({
              event_id: eventId,
              name: profile.display_name || profile.email.split('@')[0],
              email: profile.email,
              role_type: 'attendee',
              status: 'going',
            });
          }
        } catch (e) {
          console.error('Auto-RSVP error:', e);
        }
      }
      window.open(paymentLinkUrl, '_blank');
      return;
    }
    if (!stripePriceId) {
      toast.error('Tickets are not yet available for this event.');
      return;
    }
    setBuyingTicket(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
        body: { event_id: eventId },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start checkout');
      setBuyingTicket(false);
    }
  };

  const totalCount = goingCount + cantMakeItCount;

  const formatPrice = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount);
  };

  return (
    <div className="space-y-5">
      {/* Ticket confirmed state (from Stripe redirect) */}
      {hasTicketSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <Ticket className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="font-semibold text-emerald-400">Ticket Confirmed! 🎟️</p>
          <p className="text-sm text-muted-foreground">Your ticket has been purchased. See you there!</p>
        </div>
      )}

      {/* Paid event: Buy Ticket button */}
      {isPaid && !hasTicketSuccess && (
        <div className="space-y-3">
          {price && (
            <div className="text-center">
              <span className="text-2xl font-bold text-primary">{formatPrice(price, currency)}</span>
              <span className="text-sm text-muted-foreground ml-1">per ticket</span>
            </div>
          )}
          <Button
            className="w-full gap-2 text-base py-6"
            size="lg"
            onClick={handleBuyTicket}
            disabled={buyingTicket}
          >
            <Ticket className="w-5 h-5" />
            {buyingTicket ? 'Redirecting...' : 'Buy Ticket'}
          </Button>
        </div>
      )}

      {/* Free event: RSVP Button */}
      {!isPaid && !alreadyRsvpd ? (
        <Button
          className="w-full gap-2 text-base py-6"
          size="lg"
          onClick={() => setDialogOpen(true)}
        >
          <PartyPopper className="w-5 h-5" />
          RSVP to this Event
        </Button>
      ) : !isPaid ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <p className="font-semibold">{alreadyGoing ? 'Going' : 'Responded'}</p>
          <p className="text-sm text-muted-foreground">
            {alreadyGoing ? "We'll see you there ✨" : "Thanks for letting us know!"}
          </p>
        </div>
      ) : null}

      {/* Real-time counter */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-lg">Responses</h3>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 text-center rounded-lg bg-background/60 p-3">
            <p className="text-2xl font-bold text-primary">{goingCount}</p>
            <p className="text-xs text-muted-foreground">Going</p>
          </div>
          <div className="flex-1 text-center rounded-lg bg-background/60 p-3">
            <p className="text-2xl font-bold text-muted-foreground">{cantMakeItCount}</p>
            <p className="text-xs text-muted-foreground">Can't Make It</p>
          </div>
        </div>
        {totalCount > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {totalCount} {totalCount === 1 ? 'person has' : 'people have'} responded
          </p>
        )}
      </div>

      {/* Attendees dropdown */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowAttendees(!showAttendees)}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Attendees ({goingCount})</span>
          </div>
          {showAttendees ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {showAttendees && (
          <div className="border-t border-border max-h-60 overflow-y-auto">
            {goingRsvps.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No RSVPs yet — be the first!
              </p>
            ) : (
              <div className="divide-y divide-border">
                {goingRsvps.map((rsvp) => (
                  <div
                    key={rsvp.id}
                    className={cn(
                      'flex items-center gap-3 p-3',
                      rsvp.user_id && 'cursor-pointer hover:bg-accent/50 transition-colors'
                    )}
                    onClick={() => rsvp.user_id && navigate(`/profile/${rsvp.user_id}`)}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {rsvp.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rsvp.name}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs shrink-0',
                        rsvp.role_type === 'actor'
                          ? 'border-rose-400/40 text-rose-400'
                          : 'border-cyan-400/40 text-cyan-400'
                      )}
                    >
                      {rsvp.role_type === 'actor' ? 'Actor' : 'Filmmaker'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RSVP Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" />
              RSVP
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Going / Can't Make It toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setStatus('going')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                  status === 'going'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent/50 text-muted-foreground'
                )}
              >
                <Check className="w-4 h-4" />
                Going
              </button>
              <button
                type="button"
                onClick={() => setStatus('cant_make_it')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-l border-border',
                  status === 'cant_make_it'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-background hover:bg-accent/50 text-muted-foreground'
                )}
              >
                Can't Make It
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="rsvp-name">Name *</Label>
                <Input
                  id="rsvp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="rsvp-email">Email *</Label>
                <Input
                  id="rsvp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <Label>Are you an Actor or Filmmaker?</Label>
                <RadioGroup value={roleType} onValueChange={setRoleType} className="flex gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="actor" id="role-actor" />
                    <Label htmlFor="role-actor" className="cursor-pointer">Actor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="filmmaker" id="role-filmmaker" />
                    <Label htmlFor="role-filmmaker" className="cursor-pointer">Filmmaker</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Custom question from event creator */}
              {customQuestion && (
                <div>
                  <Label htmlFor="rsvp-custom">{customQuestion} *</Label>
                  <Textarea
                    id="rsvp-custom"
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    placeholder="Your answer..."
                    required
                    maxLength={500}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitRsvp.isPending}
            >
              {submitRsvp.isPending ? 'Submitting...' : 'Submit RSVP'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventRsvpForm;
