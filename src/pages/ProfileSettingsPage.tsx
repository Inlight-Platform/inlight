import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save, User, Image, Video, Music, FileText, Camera, MessageCircle, Lock, Globe, Bell, Mail } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MediaUploader } from '@/components/profile/MediaUploader';
import { AvatarCropper } from '@/components/profile/AvatarCropper';
import { useMediaUpload, useUserMedia } from '@/hooks/useMediaUpload';
import { validateProfileField, PROFILE_FIELD_LIMITS } from '@/lib/profileValidation';
import { Switch } from '@/components/ui/switch';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  message_privacy: string;
  email_notifications: boolean;
}

type MediaType = 'photo' | 'video' | 'audio' | 'document';
type Visibility = 'public' | 'connections' | 'private';

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: MediaType;
  mime_type: string;
  visibility: Visibility;
  url: string;
}

const ProfileSettingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [messagePrivacy, setMessagePrivacy] = useState('mutuals_only');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');

  const { deleteFile, updateVisibility } = useMediaUpload();
  const { fetchMedia } = useUserMedia(user?.id);

  // Fetch current profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id,
  });

  // Fetch user media
  const { data: media = [], isLoading: mediaLoading, refetch: refetchMedia } = useQuery({
    queryKey: ['user-media', user?.id],
    queryFn: fetchMedia,
    enabled: !!user?.id,
  });

  // Filter media by type
  const photos = media.filter(m => m.file_type === 'photo') as MediaItem[];
  const videos = media.filter(m => m.file_type === 'video') as MediaItem[];
  const audioFiles = media.filter(m => m.file_type === 'audio') as MediaItem[];
  const documents = media.filter(m => m.file_type === 'document') as MediaItem[];

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setHeadline(profile.headline || '');
      setMessagePrivacy(profile.message_privacy || 'mutuals_only');
      setEmailNotifications(profile.email_notifications ?? true);
    }
  }, [profile]);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a URL for the cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleCroppedAvatarUpload = async (blob: Blob) => {
    if (!user?.id) return;

    setUploadingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.jpg`;

      // Upload cropped image to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, blob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newAvatarUrl);
      
      await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('user_id', user.id);

      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Avatar updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate before submitting
    const trimmedName = displayName.trim() || null;
    const trimmedHeadline = headline.trim() || null;
    
    if (trimmedName && !validateProfileField('display_name', trimmedName)) return;
    if (trimmedHeadline && !validateProfileField('headline', trimmedHeadline)) return;
    
    updateProfile.mutate({
      display_name: trimmedName,
      avatar_url: avatarUrl.trim() || null,
      headline: trimmedHeadline,
      message_privacy: messagePrivacy,
    });
  };

  const handleDeleteMedia = async (id: string, filePath: string) => {
    await deleteFile(id, filePath);
    refetchMedia();
  };

  const handleVisibilityChange = async (id: string, visibility: Visibility) => {
    await updateVisibility(id, visibility);
    refetchMedia();
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || 'U';
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
        </div>

        {/* Profile Preview with Avatar Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription>How others will see your profile</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials(displayName, user?.email || null)}
                </AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Avatar Cropper Modal */}
            <AvatarCropper
              open={cropperOpen}
              onClose={() => setCropperOpen(false)}
              imageSrc={cropperImageSrc}
              onCropComplete={handleCroppedAvatarUpload}
            />
            <div className="space-y-1">
              <p className="font-semibold text-lg">
                {displayName || user?.email?.split('@')[0] || 'Anonymous'}
              </p>
              {headline && (
                <p className="text-muted-foreground text-sm">{headline}</p>
              )}
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit Profile
            </CardTitle>
            <CardDescription>
              Update your public profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Jane Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  This is how your name will appear to others
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Textarea
                  id="headline"
                  placeholder="Actor, Director, and Playwright based in NYC"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  A short bio or tagline ({headline.length}/200)
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  type="submit" 
                  disabled={updateProfile.isPending}
                  className="flex-1"
                >
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Message Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Message Settings
            </CardTitle>
            <CardDescription>
              Control who can send you direct messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={messagePrivacy}
              onValueChange={(value) => {
                setMessagePrivacy(value);
                updateProfile.mutate({ message_privacy: value });
              }}
              className="space-y-4"
            >
              <div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="mutuals_only" id="mutuals_only" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mutuals_only" className="flex items-center gap-2 cursor-pointer">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Mutual Connections Only</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only people you follow who also follow you back can message you
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="open" id="open" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="open" className="flex items-center gap-2 cursor-pointer">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Open to All</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Anyone on the platform can send you messages
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose whether to receive email alerts for important activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails for new messages, role applications, and project invitations
                  </p>
                </div>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={(checked) => {
                  setEmailNotifications(checked);
                  updateProfile.mutate({ email_notifications: checked });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Media Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Media</CardTitle>
            <CardDescription>
              Upload and manage your photos, videos, audio, and documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="photos" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="photos" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  <span className="hidden sm:inline">Photos</span>
                  {photos.length > 0 && <span className="text-xs">({photos.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="videos" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  <span className="hidden sm:inline">Videos</span>
                  {videos.length > 0 && <span className="text-xs">({videos.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  <span className="hidden sm:inline">Audio</span>
                  {audioFiles.length > 0 && <span className="text-xs">({audioFiles.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Docs</span>
                  {documents.length > 0 && <span className="text-xs">({documents.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="mt-6">
                {user?.id && (
                  <MediaUploader
                    userId={user.id}
                    mediaType="photo"
                    items={photos}
                    onUploadComplete={refetchMedia}
                    onDelete={handleDeleteMedia}
                    onVisibilityChange={handleVisibilityChange}
                  />
                )}
              </TabsContent>

              <TabsContent value="videos" className="mt-6">
                {user?.id && (
                  <MediaUploader
                    userId={user.id}
                    mediaType="video"
                    items={videos}
                    onUploadComplete={refetchMedia}
                    onDelete={handleDeleteMedia}
                    onVisibilityChange={handleVisibilityChange}
                  />
                )}
              </TabsContent>

              <TabsContent value="audio" className="mt-6">
                {user?.id && (
                  <MediaUploader
                    userId={user.id}
                    mediaType="audio"
                    items={audioFiles}
                    onUploadComplete={refetchMedia}
                    onDelete={handleDeleteMedia}
                    onVisibilityChange={handleVisibilityChange}
                  />
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                {user?.id && (
                  <MediaUploader
                    userId={user.id}
                    mediaType="document"
                    items={documents}
                    onUploadComplete={refetchMedia}
                    onDelete={handleDeleteMedia}
                    onVisibilityChange={handleVisibilityChange}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
