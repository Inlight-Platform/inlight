import React, { useState, useRef } from 'react';
import { Upload, FileText, Film, X, CheckCircle, Loader2 } from 'lucide-react';
import { Opportunity } from '@/store/opportunitiesStore';
import { useOpportunitiesStore } from '@/store/opportunitiesStore';
import { useStore } from '@/store/useStore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ApplyModalProps {
  opportunity: Opportunity;
  open: boolean;
  onClose: () => void;
}

const ApplyModal: React.FC<ApplyModalProps> = ({ opportunity, open, onClose }) => {
  const { applyToOpportunity } = useOpportunitiesStore();
  const { currentUserId, getCurrentUser, getCredits } = useStore();
  const { toast } = useToast();
  
  const currentUser = getCurrentUser();
  const credits = getCredits(currentUserId);
  const poster = useStore(s => s.getUser(opportunity.posterUserId));
  
  const [message, setMessage] = useState(
    `Hi ${poster?.name || 'there'}, I'm interested in ${opportunity.title}. Let's connect!`
  );
  const [showAttachments, setShowAttachments] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [reelFile, setReelFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const reelInputRef = useRef<HTMLInputElement>(null);
  
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Resume must be under 2MB', variant: 'destructive' });
        return;
      }
      if (!file.type.includes('pdf')) {
        toast({ title: 'Invalid file type', description: 'Please upload a PDF', variant: 'destructive' });
        return;
      }
      setResumeFile(file);
    }
  };
  
  const handleReelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Reel must be under 50MB', variant: 'destructive' });
        return;
      }
      if (!file.type.includes('video')) {
        toast({ title: 'Invalid file type', description: 'Please upload a video file', variant: 'destructive' });
        return;
      }
      setReelFile(file);
    }
  };
  
  const simulateUpload = async () => {
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 100));
      setUploadProgress(i);
    }
  };
  
  const handleSubmit = async () => {
    if (!currentUser) return;
    
    setIsSubmitting(true);
    
    // Simulate file upload if attachments exist
    if (resumeFile || reelFile) {
      await simulateUpload();
    }
    
    // Create profile snapshot
    const topCredits = credits.slice(0, 3).map(c => ({
      project: c.project,
      role: c.role,
      verified: c.verified,
    }));
    
    applyToOpportunity({
      opportunityId: opportunity.id,
      applicantId: currentUserId,
      message,
      resumeUrl: resumeFile ? `https://storage.inlight.app/resumes/${Date.now()}.pdf` : undefined,
      reelUrl: reelFile ? `https://storage.inlight.app/reels/${Date.now()}.mp4` : undefined,
      profileSnapshot: {
        userId: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: currentUser.role,
        badges: currentUser.badges.slice(0, 3),
        credits: topCredits,
        unionStatus: currentUser.unionStatus,
        location: currentUser.location,
        verified: credits.some(c => c.verified),
      },
    });
    
    setIsSubmitting(false);
    onClose();
    
    toast({
      title: 'Application sent!',
      description: `Your application for ${opportunity.title} has been submitted.`,
    });
  };
  
  if (!currentUser) return null;
  
  const hasVerifiedCredit = credits.some(c => c.verified);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Application</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Profile preview card */}
          <div className="p-4 bg-muted/50 rounded-xl space-y-3" aria-label="Your profile preview">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#00FF87]"
                />
                {hasVerifiedCredit && (
                  <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-500 rounded-full">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{currentUser.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{currentUser.role}</p>
              </div>
            </div>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-1">
              {currentUser.badges.slice(0, 3).map(badge => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Personal message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself..."
              className="min-h-[120px] resize-none"
              maxLength={500}
              aria-describedby="message-count"
            />
            <p id="message-count" className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </p>
          </div>
          
          {/* Attachments toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="attachments" className="cursor-pointer">
              Include attachments
            </Label>
            <Switch
              id="attachments"
              checked={showAttachments}
              onCheckedChange={setShowAttachments}
              aria-pressed={showAttachments}
            />
          </div>
          
          {/* Attachment uploads */}
          {showAttachments && (
            <div className="space-y-3">
              {/* Resume upload */}
              <div 
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-4 transition-colors",
                  resumeFile ? "border-[#00FF87] bg-[#00FF87]/5" : "border-border hover:border-muted-foreground"
                )}
              >
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Upload resume PDF"
                />
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    resumeFile ? "bg-[#00FF87]/20" : "bg-muted"
                  )}>
                    <FileText className={cn(
                      "w-5 h-5",
                      resumeFile ? "text-[#00FF87]" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    {resumeFile ? (
                      <>
                        <p className="text-sm font-medium">{resumeFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(resumeFile.size / 1024).toFixed(0)} KB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Resume (PDF)</p>
                        <p className="text-xs text-muted-foreground">Max 2MB</p>
                      </>
                    )}
                  </div>
                  {resumeFile && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setResumeFile(null);
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Reel upload */}
              <div 
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-4 transition-colors",
                  reelFile ? "border-[#00FF87] bg-[#00FF87]/5" : "border-border hover:border-muted-foreground"
                )}
              >
                <input
                  ref={reelInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleReelUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Upload reel video"
                />
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    reelFile ? "bg-[#00FF87]/20" : "bg-muted"
                  )}>
                    <Film className={cn(
                      "w-5 h-5",
                      reelFile ? "text-[#00FF87]" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    {reelFile ? (
                      <>
                        <p className="text-sm font-medium">{reelFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(reelFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Reel (60s max, 1080p)</p>
                        <p className="text-xs text-muted-foreground">Max 50MB</p>
                      </>
                    )}
                  </div>
                  {reelFile && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setReelFile(null);
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Upload progress */}
          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || message.trim().length === 0}
            className="flex-1 bg-[#00FF87] text-black hover:bg-[#00FF87]/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Application'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyModal;
