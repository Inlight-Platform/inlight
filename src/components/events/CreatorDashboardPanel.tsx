import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Shield, QrCode, Search, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreatorDashboardPanelProps {
  eventId: string;
}

interface TicketRow {
  id: string;
  ticket_code: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_role: string | null;
  status: string;
  checked_in_at: string | null;
  user_id: string | null;
}

const CreatorDashboardPanel: React.FC<CreatorDashboardPanelProps> = ({ eventId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['creator-dashboard-tickets', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, attendee_name, attendee_email, attendee_role, status, checked_in_at, user_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
    enabled: !!eventId && open,
    refetchInterval: open ? 5000 : false,
  });

  const total = tickets.length;
  const checkedIn = tickets.filter((t) => t.checked_in_at).length;
  const remaining = Math.max(0, total - checkedIn);
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      [t.attendee_name, t.attendee_email].some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [tickets, search]);

  const handleManualCheckIn = async (ticket: TicketRow) => {
    if (!ticket.ticket_code) {
      toast.error('This ticket has no code yet.');
      return;
    }
    setCheckingInId(ticket.id);
    try {
      const { data, error } = await supabase.functions.invoke('verify-ticket', {
        body: { ticket_code: ticket.ticket_code, event_id: eventId, action: 'check_in' },
      });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === 'valid') {
        toast.success(`Checked in ${ticket.attendee_name ?? 'attendee'}`);
      } else if (status === 'already_used') {
        toast.warning('Ticket already checked in');
      } else {
        toast.error((data as any)?.message || 'Could not check in');
      }
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard-tickets', eventId] });
    } catch (err: any) {
      toast.error(err?.message || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open creator dashboard"
          className="fixed top-5 left-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.03] active:scale-95 transition-all border border-primary/30 backdrop-blur"
        >
          <Shield className="w-4 h-4" />
          <span className="text-sm font-semibold hidden sm:inline">Creator Dashboard</span>
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Creator Dashboard
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* QR Scanner trigger */}
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => {
              setOpen(false);
              navigate(`/manage-event/${eventId}/scanner`);
            }}
          >
            <QrCode className="w-4 h-4" />
            Open QR Scanner
          </Button>

          {/* Live tracking stats */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Live Guest Tracking</h3>
              <Badge variant="secondary" className="text-xs">{pct}% arrived</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Tickets" value={total} tone="text-foreground" />
              <Stat label="Checked-In" value={checkedIn} tone="text-emerald-500" />
              <Stat label="Remaining" value={remaining} tone="text-amber-500" />
            </div>

            <Progress value={pct} className="h-2" />
          </div>

          {/* Manual check-in search */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Manual Check-in</h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9"
              />
            </div>

            <div className="rounded-xl border border-border divide-y divide-border max-h-[40vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  {tickets.length === 0 ? 'No tickets yet.' : 'No matching guests.'}
                </p>
              ) : (
                filteredTickets.map((t) => {
                  const isCheckedIn = !!t.checked_in_at;
                  const isLoadingRow = checkingInId === t.id;
                  return (
                    <div key={t.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.attendee_name || 'Unnamed guest'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.attendee_email}
                          {t.attendee_role ? ` · ${t.attendee_role}` : ''}
                        </p>
                      </div>
                      {isCheckedIn ? (
                        <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />
                          In
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoadingRow}
                          onClick={() => handleManualCheckIn(t)}
                          className="gap-1"
                        >
                          {isLoadingRow ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Check in
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Stat: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className="text-center rounded-lg bg-muted/40 py-3">
    <p className={cn('text-2xl font-bold leading-none', tone)}>{value}</p>
    <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
  </div>
);

export default CreatorDashboardPanel;
