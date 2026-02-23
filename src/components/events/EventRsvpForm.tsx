import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEventRsvps } from '@/hooks/useEventRsvps';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, X, Users, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventRsvpFormProps {
  eventId: string;
}

const EventRsvpForm: React.FC<EventRsvpFormProps> = ({ eventId }) => {
  const { goingRsvps, goingCount, cantMakeItCount, submitRsvp } = useEventRsvps(eventId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleType, setRoleType] = useState('actor');
  const [status, setStatus] = useState<'going' | 'cant_make_it'>('going');
  const [showAttendees, setShowAttendees] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    submitRsvp.mutate(
      { event_id: eventId, name: name.trim(), email: email.trim(), role_type: roleType, status },
      {
        onSuccess: () => {
          toast.success(status === 'going' ? "You're on the list! 🎉" : 'Thanks for letting us know!');
          setSubmitted(true);
        },
        onError: () => toast.error('Something went wrong. Try again.'),
      }
    );
  };

  const totalCount = goingCount + cantMakeItCount;

  return (
    <div className="space-y-5">
      {/* Real-time counter */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-lg">RSVP</h3>
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
            <span className="font-medium text-sm">Who's Going ({goingCount})</span>
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
                  <div key={rsvp.id} className="flex items-center gap-3 p-3">
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

      {/* RSVP Form */}
      {submitted ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <p className="font-semibold">You're all set!</p>
          <p className="text-sm text-muted-foreground">We'll see you there ✨</p>
        </div>
      ) : (
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
              <X className="w-4 h-4" />
              Can't Make It
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="rsvp-name">Name</Label>
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
              <Label htmlFor="rsvp-email">Email</Label>
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
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitRsvp.isPending}
          >
            {submitRsvp.isPending ? 'Submitting...' : 'Submit RSVP'}
          </Button>
        </form>
      )}
    </div>
  );
};

export default EventRsvpForm;
