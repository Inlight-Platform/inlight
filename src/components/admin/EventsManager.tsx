import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronRight, Users, Camera, CheckCircle2, XCircle, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

const EventsManager: React.FC = () => {
  const { user } = useAuth();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);

  // Fetch all events created by the Inlight account
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-inlight-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Inlight Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading events...</p>
        ) : events?.length === 0 ? (
          <p className="text-muted-foreground">No events created by Inlight yet.</p>
        ) : (
          <div className="space-y-2">
            {events?.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isExpanded={expandedEventId === event.id}
                onToggle={() =>
                  setExpandedEventId(expandedEventId === event.id ? null : event.id)
                }
                onScan={() => setScannerEventId(event.id)}
              />
            ))}
          </div>
        )}

        {scannerEventId && (
          <QrScannerDialog
            eventId={scannerEventId}
            onClose={() => setScannerEventId(null)}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Single event row with expandable RSVP list
const EventRow: React.FC<{
  event: any;
  isExpanded: boolean;
  onToggle: () => void;
  onScan: () => void;
}> = ({ event, isExpanded, onToggle, onScan }) => {
  const { data: rsvps, isLoading } = useQuery({
    queryKey: ['event-rsvps', event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isExpanded,
  });

  const goingCount = rsvps?.filter((r) => r.status === 'going').length ?? 0;
  const attendedCount = rsvps?.filter((r) => r.attended).length ?? 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{event.title}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.event_date), 'MMM d, yyyy · h:mm a')}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 ml-2">
            {event.is_paid && (
              <Badge variant="secondary" className="text-xs">Paid</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onScan();
              }}
              className="gap-1"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-3 space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading RSVPs...</p>
            ) : rsvps?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <strong>{goingCount}</strong> going
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <strong>{attendedCount}</strong> checked in
                  </span>
                </div>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {rsvps?.map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center justify-between bg-background rounded-md p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{rsvp.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {rsvp.email} · {rsvp.role_type}
                        </div>
                      </div>
                      <div className="ml-2 shrink-0">
                        {rsvp.attended ? (
                          <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Checked in
                          </Badge>
                        ) : rsvp.status === 'going' ? (
                          <Badge variant="outline">Going</Badge>
                        ) : (
                          <Badge variant="secondary">{rsvp.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// QR Scanner Dialog
const QrScannerDialog: React.FC<{
  eventId: string;
  onClose: () => void;
}> = ({ eventId, onClose }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-scanner-container';
  const [scanning, setScanning] = useState(true);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    name?: string;
  } | null>(null);
  const processingRef = useRef(false);

  const checkInTicket = async (ticketCode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      // Look up ticket by code for this event
      const { data: ticket, error: lookupError } = await supabase
        .from('tickets')
        .select('id, event_id, attendee_name, attendee_email, checked_in_at, status')
        .eq('ticket_code', ticketCode)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!ticket) {
        setLastResult({ success: false, message: 'Ticket not found' });
        return;
      }
      if (ticket.event_id !== eventId) {
        setLastResult({ success: false, message: 'Ticket is for a different event' });
        return;
      }
      if (ticket.checked_in_at) {
        setLastResult({
          success: false,
          message: 'Already checked in',
          name: ticket.attendee_name ?? undefined,
        });
        return;
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id,
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      setLastResult({
        success: true,
        message: 'Checked in successfully',
        name: ticket.attendee_name ?? undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
      toast.success(`${ticket.attendee_name ?? 'Attendee'} checked in`);
    } catch (err: any) {
      setLastResult({ success: false, message: err.message ?? 'Check-in failed' });
    } finally {
      // Allow scanning the next code after a brief pause
      setTimeout(() => {
        processingRef.current = false;
      }, 1500);
    }
  };

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          checkInTicket(decodedText.trim());
        },
        () => {
          // ignore per-frame decode errors
        }
      )
      .catch((err) => {
        setScanning(false);
        toast.error('Unable to access camera: ' + (err?.message ?? 'permission denied'));
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Ticket QR
          </DialogTitle>
          <DialogDescription>
            Point your camera at an attendee's ticket QR code to check them in.
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
          <div id={containerId} className="w-full h-full" />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center">
              Camera unavailable. Check browser permissions.
            </div>
          )}
        </div>

        {lastResult && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              lastResult.success
                ? 'bg-green-50 text-green-900 border border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-900'
                : 'bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900'
            }`}
          >
            {lastResult.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="font-medium">{lastResult.message}</div>
              {lastResult.name && <div className="text-xs opacity-80">{lastResult.name}</div>}
            </div>
          </div>
        )}

        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default EventsManager;
