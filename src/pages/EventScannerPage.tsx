import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Camera, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ScanResultStatus = 'valid' | 'already_used' | 'invalid' | 'error';

interface ScanResult {
  status: ScanResultStatus;
  message?: string;
  ticket?: {
    id: string;
    name: string;
    role?: string | null;
    email?: string | null;
    event_title?: string;
    checked_in_at?: string | null;
  };
}

const SCANNER_ELEMENT_ID = 'inlight-qr-scanner';

const EventScannerPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  // Load event + permission check
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event-scanner', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, user_id, event_date')
        .eq('id', eventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Live attendance counts
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['event-scanner-stats', eventId],
    queryFn: async () => {
      const [totalRes, scannedRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId!),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId!)
          .not('checked_in_at', 'is', null),
      ]);
      return {
        total: totalRes.count ?? 0,
        scanned: scannedRes.count ?? 0,
      };
    },
    enabled: !!eventId,
    refetchInterval: 5000,
  });

  const canScan = !!event && !!user && (event.user_id === user.id || isAdmin);

  const verifyCode = useCallback(
    async (code: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-ticket', {
          body: { ticket_code: code, event_id: eventId, action: 'check_in' },
        });
        if (error) throw error;
        setResult(data as ScanResult);
        refetchStats();
      } catch (err: any) {
        setResult({ status: 'error', message: err?.message || 'Verification failed' });
      }
    },
    [eventId, refetchStats],
  );

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      // Debounce duplicate scans for 3s
      const now = Date.now();
      if (lastScanRef.current && lastScanRef.current.code === decodedText && now - lastScanRef.current.at < 3000) {
        return;
      }
      lastScanRef.current = { code: decodedText, at: now };
      verifyCode(decodedText);
    },
    [verifyCode],
  );

  const startScanner = async () => {
    if (scannerRef.current || starting) return;
    setStarting(true);
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        handleScanSuccess,
        () => {
          // ignore per-frame decode failures
        },
      );
      setScanning(true);
    } catch (err: any) {
      console.error('[scanner] start error', err);
      toast.error(err?.message || 'Could not access camera. Check browser permissions.');
      scannerRef.current = null;
    } finally {
      setStarting(false);
    }
  };

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Event not found</h1>
        <Button variant="outline" onClick={() => navigate('/events')} className="mt-4">
          Back to events
        </Button>
      </div>
    );
  }

  if (!canScan) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
        <p className="text-muted-foreground mb-6">
          Only the event creator and Inlight admins can access the check-in scanner.
        </p>
        <Button variant="outline" onClick={() => navigate(`/events/${eventId}`)}>
          Back to event
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${eventId}`)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="font-medium text-foreground">{stats?.scanned ?? 0}</span>
          <span>/ {stats?.total ?? 0} checked in</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-display font-bold leading-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Check-in scanner</p>
      </div>

      {/* Scanner */}
      <Card className="overflow-hidden">
        <div
          id={SCANNER_ELEMENT_ID}
          className={cn(
            'w-full bg-black',
            scanning ? 'min-h-[320px]' : 'min-h-0',
          )}
        />
        <div className="p-4 flex flex-col sm:flex-row items-stretch gap-3">
          {!scanning ? (
            <Button onClick={startScanner} disabled={starting} className="flex-1 gap-2" size="lg">
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {starting ? 'Starting camera…' : 'Start scanning'}
            </Button>
          ) : (
            <Button onClick={stopScanner} variant="outline" className="flex-1" size="lg">
              Stop scanner
            </Button>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Point your camera at the attendee's QR code. Each ticket can only be used once.
      </p>

      {/* Result modal */}
      <ResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
};

const ResultModal: React.FC<{ result: ScanResult | null; onClose: () => void }> = ({ result, onClose }) => {
  // Auto-dismiss successful scans after 2.5s so the next attendee can step up
  useEffect(() => {
    if (!result) return;
    if (result.status === 'valid') {
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [result, onClose]);

  if (!result) return null;

  const config = {
    valid: {
      Icon: CheckCircle2,
      title: 'Welcome in!',
      tone: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500',
      iconBg: 'bg-emerald-500/20',
    },
    already_used: {
      Icon: AlertTriangle,
      title: 'Ticket already used',
      tone: 'bg-amber-500/10 border-amber-500/40 text-amber-500',
      iconBg: 'bg-amber-500/20',
    },
    invalid: {
      Icon: XCircle,
      title: 'Ticket not found',
      tone: 'bg-red-500/10 border-red-500/40 text-red-500',
      iconBg: 'bg-red-500/20',
    },
    error: {
      Icon: XCircle,
      title: 'Scan error',
      tone: 'bg-red-500/10 border-red-500/40 text-red-500',
      iconBg: 'bg-red-500/20',
    },
  }[result.status];

  const { Icon, title, tone, iconBg } = config;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('sm:max-w-sm border-2', tone)}>
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center py-2 space-y-3">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', iconBg)}>
            <Icon className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {result.ticket?.name && (
            <p className="text-lg font-semibold text-foreground">{result.ticket.name}</p>
          )}
          {result.ticket?.role && (
            <p className="text-sm text-muted-foreground capitalize">{result.ticket.role}</p>
          )}
          {result.status === 'already_used' && result.ticket?.checked_in_at && (
            <p className="text-xs text-muted-foreground">
              Checked in at {new Date(result.ticket.checked_in_at).toLocaleTimeString()}
            </p>
          )}
          {(result.status === 'invalid' || result.status === 'error') && (
            <p className="text-sm text-muted-foreground">{result.message}</p>
          )}
        </div>
        <Button onClick={onClose} className="w-full" variant="outline">
          Continue scanning
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default EventScannerPage;
