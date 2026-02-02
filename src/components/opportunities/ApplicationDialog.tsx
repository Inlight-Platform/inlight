import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, User, Link2, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

interface ApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityTitle: string;
  onApplicationSubmitted: () => void;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
}

type Profile = Tables<'profiles'>;

const ApplicationDialog: React.FC<ApplicationDialogProps> = ({
  open,
  onOpenChange,
  opportunityId,
  opportunityTitle,
  onApplicationSubmitted,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [includeProfile, setIncludeProfile] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setProfile(data);
    };
    
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/applications/${opportunityId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-media')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('profile-media')
          .getPublicUrl(fileName);

        newFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
        });
      }

      setUploadedFiles([...uploadedFiles, ...newFiles]);
      if (newFiles.length > 0) {
        toast.success(`Uploaded ${newFiles.length} file(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to apply');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('opportunity_applications')
        .insert([{
          opportunity_id: opportunityId,
          applicant_id: user.id,
          message: message.trim() || null,
          resume_url: resumeUrl.trim() || null,
          portfolio_url: portfolioUrl.trim() || null,
          additional_materials: JSON.stringify(uploadedFiles),
          include_profile: includeProfile,
        }]);

      if (error) {
        console.error('Application error:', error);
        toast.error('Failed to submit application');
        return;
      }

      toast.success('Application submitted successfully!');
      onApplicationSubmitted();
      onOpenChange(false);
      
      // Reset form
      setMessage('');
      setResumeUrl('');
      setPortfolioUrl('');
      setUploadedFiles([]);
      setIncludeProfile(true);
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to {opportunityTitle}</DialogTitle>
          <DialogDescription>
            Submit your application with your profile, materials, and a message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Include Profile Section */}
          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="include-profile"
                checked={includeProfile}
                onCheckedChange={(checked) => setIncludeProfile(checked as boolean)}
              />
              <div className="flex-1">
                <Label 
                  htmlFor="include-profile" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Include your Inlight profile
                </Label>
                {profile && (
                  <div className="flex items-center gap-3 mt-3 p-3 bg-background rounded-lg border border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.display_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.headline || profile.role || 'Inlight Member'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/profile/${user?.id}`)}
                    >
                      View
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Message Section */}
          <div className="space-y-2">
            <Label htmlFor="message">Cover Letter / Message</Label>
            <Textarea
              id="message"
              placeholder="Tell them why you're a great fit for this opportunity..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          {/* Links Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resume" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Resume/CV Link
              </Label>
              <Input
                id="resume"
                type="url"
                placeholder="https://drive.google.com/your-resume"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Portfolio / Reel Link
              </Label>
              <Input
                id="portfolio"
                type="url"
                placeholder="https://vimeo.com/your-reel"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
              />
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Additional Materials
            </Label>
            
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isUploading 
                    ? 'Uploading...' 
                    : 'Click to upload files (PDF, DOC, images, videos)'
                  }
                </span>
                <span className="text-xs text-muted-foreground">Max 10MB per file</span>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (!message.trim() && !includeProfile && uploadedFiles.length === 0)}
            className="flex-1 bg-[hsl(var(--neon-opportunities))] text-foreground hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationDialog;
