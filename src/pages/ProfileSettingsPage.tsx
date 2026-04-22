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
import { Loader2, ArrowLeft, Save, User, Image, Video, Music, FileText, Camera, MessageCircle, Lock, Globe, Bell, Mail, Briefcase, X, Plus, Eye, EyeOff, KeyRound, Star, Compass } from 'lucide-react';
import ShowcaseSettings from '@/components/profile/ShowcaseSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MediaUploader } from '@/components/profile/MediaUploader';
import { AvatarCropper } from '@/components/profile/AvatarCropper';
import { useMediaUpload, useUserMedia } from '@/hooks/useMediaUpload';
import { validateProfileField, PROFILE_FIELD_LIMITS } from '@/lib/profileValidation';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useTour } from '@/hooks/useTour';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  message_privacy: string;
  email_notifications: boolean;
  union_status: string | null;
  representation: string | null;
  gear_list: string[] | null;
  show_union_status: boolean;
  show_representation: boolean;
  show_gear_list: boolean;
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

const ChangePasswordCard: React.FC = () => {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(newPassword);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Failed to update password');
    } else {
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={saving || !newPassword || !confirmPassword}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ProfileSettingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [stageName, setStageName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [messagePrivacy, setMessagePrivacy] = useState('mutuals_only');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');
  
  // Professional details state
  const [unionStatus, setUnionStatus] = useState('');
  const [representation, setRepresentation] = useState('');
  const [gearList, setGearList] = useState<string[]>([]);
  const [newGear, setNewGear] = useState('');
  const [showUnionStatus, setShowUnionStatus] = useState(false);
  const [showRepresentation, setShowRepresentation] = useState(false);
  const [showGearList, setShowGearList] = useState(false);

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
      setStageName(profile.stage_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setHeadline(profile.headline || '');
      setMessagePrivacy(profile.message_privacy || 'mutuals_only');
      setEmailNotifications(profile.email_notifications ?? true);
      // Professional details
      setUnionStatus(profile.union_status || '');
      setRepresentation(profile.representation || '');
      setGearList(profile.gear_list || []);
      setShowUnionStatus(profile.show_union_status ?? false);
      setShowRepresentation(profile.show_representation ?? false);
      setShowGearList(profile.show_gear_list ?? false);
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
    const trimmedStageName = stageName.trim() || null;
    const trimmedHeadline = headline.trim() || null;
    
    if (trimmedName && !validateProfileField('display_name', trimmedName)) return;
    if (trimmedStageName && !validateProfileField('stage_name', trimmedStageName)) return;
    if (trimmedHeadline && !validateProfileField('headline', trimmedHeadline)) return;
    
    updateProfile.mutate({
      display_name: trimmedName,
      stage_name: trimmedStageName,
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
                <Label htmlFor="stageName">Stage Name</Label>
                <Input
                  id="stageName"
                  type="text"
                  placeholder="Your stage or professional name (optional)"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  If you have a stage name, it will display prominently on your profile
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

        {/* Change Password */}
        <ChangePasswordCard />

        {/* Professional Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Professional Details
            </CardTitle>
            <CardDescription>
              Manage your union status, representation, and personal gear. Toggle which ones appear on your public profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Union Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="unionStatus">Union Status</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="showUnionStatus" className="text-sm text-muted-foreground">
                    Display on profile
                  </Label>
                  <Checkbox
                    id="showUnionStatus"
                    checked={showUnionStatus}
                    onCheckedChange={(checked) => {
                      setShowUnionStatus(checked === true);
                      updateProfile.mutate({ show_union_status: checked === true });
                    }}
                  />
                </div>
              </div>
              <Input
                id="unionStatus"
                type="text"
                placeholder="e.g., SAG-AFTRA, AEA, Non-Union"
                value={unionStatus}
                onChange={(e) => setUnionStatus(e.target.value)}
                onBlur={() => {
                  updateProfile.mutate({ union_status: unionStatus.trim() || null });
                }}
                maxLength={100}
              />
            </div>

            {/* Representation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="representation">Representation</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="showRepresentation" className="text-sm text-muted-foreground">
                    Display on profile
                  </Label>
                  <Checkbox
                    id="showRepresentation"
                    checked={showRepresentation}
                    onCheckedChange={(checked) => {
                      setShowRepresentation(checked === true);
                      updateProfile.mutate({ show_representation: checked === true });
                    }}
                  />
                </div>
              </div>
              <Input
                id="representation"
                type="text"
                placeholder="e.g., Agency name"
                value={representation}
                onChange={(e) => setRepresentation(e.target.value)}
                onBlur={() => {
                  updateProfile.mutate({ representation: representation.trim() || null });
                }}
                maxLength={200}
              />
            </div>

            {/* Personal Gear */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Personal Gear</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="showGearList" className="text-sm text-muted-foreground">
                    Display on profile
                  </Label>
                  <Checkbox
                    id="showGearList"
                    checked={showGearList}
                    onCheckedChange={(checked) => {
                      setShowGearList(checked === true);
                      updateProfile.mutate({ show_gear_list: checked === true });
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {gearList.map((gear, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
                    <span className="text-sm">{gear}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = gearList.filter((_, idx) => idx !== i);
                        setGearList(updated);
                        updateProfile.mutate({ gear_list: updated });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Add gear item"
                  value={newGear}
                  onChange={(e) => setNewGear(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGear.trim()) {
                      e.preventDefault();
                      if (newGear.trim().length > 100) {
                        toast.error('Gear item must be 100 characters or less');
                        return;
                      }
                      if (gearList.includes(newGear.trim())) {
                        toast.error('Gear already exists');
                        return;
                      }
                      const updated = [...gearList, newGear.trim()];
                      setGearList(updated);
                      setNewGear('');
                      updateProfile.mutate({ gear_list: updated });
                    }
                  }}
                  maxLength={100}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!newGear.trim()) return;
                    if (newGear.trim().length > 100) {
                      toast.error('Gear item must be 100 characters or less');
                      return;
                    }
                    if (gearList.includes(newGear.trim())) {
                      toast.error('Gear already exists');
                      return;
                    }
                    const updated = [...gearList, newGear.trim()];
                    setGearList(updated);
                    setNewGear('');
                    updateProfile.mutate({ gear_list: updated });
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or click + to add gear items
              </p>
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
              <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
                  <TabsTrigger value="photos" className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                    <Image className="h-4 w-4" />
                    <span className="hidden sm:inline">Photos</span>
                    {photos.length > 0 && <span className="text-xs">({photos.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                    <Video className="h-4 w-4" />
                    <span className="hidden sm:inline">Videos</span>
                    {videos.length > 0 && <span className="text-xs">({videos.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                    <Music className="h-4 w-4" />
                    <span className="hidden sm:inline">Audio</span>
                    {audioFiles.length > 0 && <span className="text-xs">({audioFiles.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Docs</span>
                    {documents.length > 0 && <span className="text-xs">({documents.length})</span>}
                  </TabsTrigger>
                </TabsList>
              </div>

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

        {/* Showcase Settings */}
        <ShowcaseSettings />
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
