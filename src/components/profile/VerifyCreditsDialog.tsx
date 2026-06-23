import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Upload, X, Loader2, FileText, Check, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVerificationRequests } from '@/hooks/useCreditVerification';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const { myRequests, submitRequest, isSubmitting } = useVerificationRequests();
  const [open, setOpen] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter to unverified credits that don't have pending requests
  const pendingRequestCreditIds = myRequests
    .filter(r => r.status === 'pending')
    .map(r => r.credit_id);

  const unverifiedCredits = credits.filter(
    c => !c.verified && !pendingRequestCreditIds.includes(c.id)
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user?.id) return;

    setUploading(true);
    try {
      const newFiles: { name: string; url: string }[] = [];

      for (const file of Array.from(files)) {
        const fileName = `${user.id}/verification/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from('profile-media')
          .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('profile-media')
          .getPublicUrl(fileName);

        newFiles.push({ name: file.name, url: urlData.publicUrl });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) uploaded`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (url: string) => {
    setUploadedFiles(prev => prev.filter(f => f.url !== url));
  };

  const handleSubmit = async () => {
    if (selectedCredits.length === 0) {
      toast.error('Please select at least one credit to verify');
      return;
    }

    // Submit a request for each selected credit
    for (const creditId of selectedCredits) {
      submitRequest({
        creditId,
        materialsUrls: uploadedFiles.map(f => f.url),
        notes,
      });
    }

    // Reset and close
    setSelectedCredits([]);
    setNotes('');
    setUploadedFiles([]);
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
      <DialogContent className="max-w-lg">
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
              Select the credits you'd like to verify. You can also upload supporting materials (contracts, call sheets, credits screenshots, etc.)
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
              <div>
                <label className="text-sm font-medium mb-2 block">Supporting Materials</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload Files
                </Button>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map(file => (
                      <div
                        key={file.url}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{file.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeFile(file.url)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
