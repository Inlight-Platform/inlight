import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, User, Visibility } from '../store/useStore';
import { useTrackProfileView, useUpdateEngagement } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { useMediaUpload, useUserMedia } from '@/hooks/useMediaUpload';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Flag, 
  Ban, 
  Share2, 
  Check, 
  Clock, 
  Plus, 
  Eye, 
  EyeOff,
  Users,
  ChevronLeft,
  Pencil,
  Camera,
  Loader2
} from 'lucide-react';
import { PublicMediaGallery } from '@/components/profile/PublicMediaGallery';
import { MediaUploader } from '@/components/profile/MediaUploader';
import { AvatarCropper } from '@/components/profile/AvatarCropper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type MediaType = 'photo' | 'video' | 'audio' | 'document';
type MediaVisibility = 'public' | 'connections' | 'private';

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: MediaType;
  mime_type: string;
  visibility: MediaVisibility;
  url: string;
}

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const currentUserId = useStore((s) => s.currentUserId);
  const getUser = useStore((s) => s.getUser);
  const getConnectionStatus = useStore((s) => s.getConnectionStatus);
  const sendConnectionRequest = useStore((s) => s.sendConnectionRequest);
  const addBadge = useStore((s) => s.addBadge);
  const getMaterials = useStore((s) => s.getMaterials);
  const getCredits = useStore((s) => s.getCredits);
  const updateMaterialVisibility = useStore((s) => s.updateMaterialVisibility);
  
  const [newBadge, setNewBadge] = useState('');
  const [addCreditOpen, setAddCreditOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [announced, setAnnounced] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');
  
  const resolvedUserId = userId === 'me' ? currentUserId : userId;
  const user = getUser(resolvedUserId || '');
  const isOwnProfile = resolvedUserId === currentUserId;
  const connectionStatus = resolvedUserId ? getConnectionStatus(resolvedUserId) : null;
  
  // Media upload hooks
  const { deleteFile, updateVisibility } = useMediaUpload();
  const { fetchMedia } = useUserMedia(authUser?.id);
  
  // Fetch profile from database to get current avatar
  const { data: dbProfile } = useQuery({
    queryKey: ['profile', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', authUser.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!authUser?.id && isOwnProfile,
  });
  
  // Use database avatar if available, otherwise fall back to store
  const displayAvatar = (isOwnProfile && dbProfile?.avatar_url) || user?.avatar;
  
  // Fetch user media from database
  const { data: userMedia = [], refetch: refetchMedia } = useQuery({
    queryKey: ['user-media', authUser?.id],
    queryFn: fetchMedia,
    enabled: !!authUser?.id && isOwnProfile,
  });
  
  // Filter media by type
  const uploadedPhotos = userMedia.filter(m => m.file_type === 'photo') as MediaItem[];
  const uploadedVideos = userMedia.filter(m => m.file_type === 'video') as MediaItem[];
  const uploadedAudio = userMedia.filter(m => m.file_type === 'audio') as MediaItem[];
  const uploadedDocuments = userMedia.filter(m => m.file_type === 'document') as MediaItem[];
  
  // Track profile view when visiting someone else's profile
  useTrackProfileView(resolvedUserId || '');
  const { updateEngagement } = useUpdateEngagement();
  
  const materials = resolvedUserId ? getMaterials(resolvedUserId) : [];
  const credits = resolvedUserId ? getCredits(resolvedUserId) : [];
  
  const photos = materials.filter(m => m.type === 'photo');
  const reels = materials.filter(m => m.type === 'reel');
  const resumes = materials.filter(m => m.type === 'resume');
  const audio = materials.filter(m => m.type === 'audio');
  
  useEffect(() => {
    setAnnounced(false);
    // Update engagement for profile views
    if (!isOwnProfile && resolvedUserId) {
      updateEngagement(resolvedUserId, 'profile_views');
    }
  }, [userId, isOwnProfile, resolvedUserId]);
  
  // Avatar upload handlers
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleCroppedAvatarUpload = async (blob: Blob) => {
    if (!authUser?.id) return;

    setUploadingAvatar(true);
    try {
      const fileName = `${authUser.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, blob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('user_id', authUser.id);

      // Invalidate profile query to show new avatar immediately
      await queryClient.invalidateQueries({ queryKey: ['profile', authUser.id] });

      toast.success('Avatar updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteMedia = async (id: string, filePath: string) => {
    await deleteFile(id, filePath);
    refetchMedia();
  };

  const handleVisibilityChange = async (id: string, visibility: MediaVisibility) => {
    await updateVisibility(id, visibility);
    refetchMedia();
  };
  
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">User not found</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }
  
  const handleConnect = () => {
    if (!resolvedUserId || isOwnProfile) return;
    sendConnectionRequest(resolvedUserId);
    setAnnounced(true);
    // Screen reader announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Connection request sent to ${user.name}.`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 3000);
  };
  
  const handleMessage = () => {
    navigate('/messages');
  };
  
  const handleAddBadge = () => {
    if (!newBadge.trim() || !isOwnProfile) return;
    const normalized = newBadge.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 25);
    if (normalized) {
      addBadge(currentUserId, normalized);
      setNewBadge('');
    }
  };
  
  const handleBadgeClick = (badge: string) => {
    navigate(`/directory/${badge}`);
  };
  
  const getConnectButtonLabel = () => {
    if (isOwnProfile) return null;
    if (connectionStatus === 'accepted') return 'Message';
    if (connectionStatus === 'pending') return 'Pending';
    return 'Connect';
  };
  
  const getConnectButtonClass = () => {
    if (connectionStatus === 'accepted') return 'btn-connect btn-connect-message';
    if (connectionStatus === 'pending') return 'btn-connect btn-connect-pending';
    return 'btn-connect';
  };
  
  const getVisibilityIcon = (visibility: Visibility) => {
    switch (visibility) {
      case 'public': return <Eye className="w-4 h-4" />;
      case 'connections': return <Users className="w-4 h-4" />;
      case 'private': return <EyeOff className="w-4 h-4" />;
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm shadow-card hover:bg-accent transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      
      {/* A. Header */}
      <header className="relative">
        {/* Cover image */}
        <div className="relative h-[200px] sm:h-[280px] md:h-[350px] lg:h-[450px] overflow-hidden">
          <img
            src={user.coverImage}
            alt={`${user.name}'s cover`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
        
        {/* Profile info */}
        <div className="relative px-4 sm:px-6 lg:px-8 pb-6">
          {/* Avatar */}
          <div className="absolute -top-16 sm:-top-20 left-4 sm:left-6 lg:left-8">
            <div className="relative">
              <img
                src={displayAvatar}
                alt={user.name}
                className="w-24 h-24 sm:w-32 sm:h-32 lg:w-[120px] lg:h-[120px] rounded-full border-4 border-background object-cover shadow-card"
              />
              {isOwnProfile && (
                <>
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
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    aria-label="Change profile picture"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <AvatarCropper
                    open={cropperOpen}
                    onClose={() => setCropperOpen(false)}
                    imageSrc={cropperImageSrc}
                    onCropComplete={handleCroppedAvatarUpload}
                  />
                </>
              )}
            </div>
          </div>
          
          {/* Name and info */}
          <div className="pt-12 sm:pt-16 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-sm font-medium">
                  {user.role}
                </Badge>
                <span className="text-muted-foreground text-sm">{user.location}</span>
                <span className="text-muted-foreground text-sm">({user.pronouns})</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {!isOwnProfile && (
                <button
                  onClick={connectionStatus === 'accepted' ? handleMessage : handleConnect}
                  disabled={connectionStatus === 'pending'}
                  className={getConnectButtonClass()}
                  aria-label={getConnectButtonLabel() || undefined}
                >
                  {getConnectButtonLabel()}
                </button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <MoreHorizontal className="w-5 h-5" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem>
                    <Flag className="w-4 h-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Ban className="w-4 h-4 mr-2" />
                    Block
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      
      {/* B. Badges */}
      <section className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin pb-2">
          {user.badges.map((badge) => (
            <button
              key={badge}
              onClick={() => handleBadgeClick(badge)}
              className="badge-pill flex-shrink-0"
            >
              #{badge}
            </button>
          ))}
          
          {isOwnProfile && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                type="text"
                placeholder="Add badge..."
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBadge()}
                className="w-32 h-8 text-sm"
                maxLength={25}
              />
              <Button 
                size="sm" 
                onClick={handleAddBadge}
                className="h-8 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </section>
      
      {/* C. Materials (own profile) */}
      {isOwnProfile && authUser?.id && (
        <section className="px-4 sm:px-6 lg:px-8 py-6">
          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-md">
              <TabsTrigger value="photos">Photos {uploadedPhotos.length > 0 && `(${uploadedPhotos.length})`}</TabsTrigger>
              <TabsTrigger value="reels">Reels {uploadedVideos.length > 0 && `(${uploadedVideos.length})`}</TabsTrigger>
              <TabsTrigger value="resume">Résumé {uploadedDocuments.length > 0 && `(${uploadedDocuments.length})`}</TabsTrigger>
              <TabsTrigger value="audio">Audio {uploadedAudio.length > 0 && `(${uploadedAudio.length})`}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="photos" className="mt-6">
              <MediaUploader
                userId={authUser.id}
                mediaType="photo"
                items={uploadedPhotos}
                onUploadComplete={() => refetchMedia()}
                onDelete={handleDeleteMedia}
                onVisibilityChange={handleVisibilityChange}
              />
            </TabsContent>
            
            <TabsContent value="reels" className="mt-6">
              <MediaUploader
                userId={authUser.id}
                mediaType="video"
                items={uploadedVideos}
                onUploadComplete={() => refetchMedia()}
                onDelete={handleDeleteMedia}
                onVisibilityChange={handleVisibilityChange}
              />
            </TabsContent>
            
            <TabsContent value="resume" className="mt-6">
              <MediaUploader
                userId={authUser.id}
                mediaType="document"
                items={uploadedDocuments}
                onUploadComplete={() => refetchMedia()}
                onDelete={handleDeleteMedia}
                onVisibilityChange={handleVisibilityChange}
              />
            </TabsContent>
            
            <TabsContent value="audio" className="mt-6">
              <MediaUploader
                userId={authUser.id}
                mediaType="audio"
                items={uploadedAudio}
                onUploadComplete={() => refetchMedia()}
                onDelete={handleDeleteMedia}
                onVisibilityChange={handleVisibilityChange}
              />
            </TabsContent>
          </Tabs>
        </section>
      )}

      {/* Public Media Gallery (for other users' profiles) */}
      {!isOwnProfile && resolvedUserId && (
        <PublicMediaGallery 
          userId={resolvedUserId} 
          isConnected={connectionStatus === 'accepted'}
        />
      )}
      
      {/* D. Credits */}
      <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold">Credits</h2>
          {isOwnProfile && (
            <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Credit
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Add Credit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Project title" />
                  <Input placeholder="Role" />
                  <Input placeholder="Year" type="number" />
                  <Input placeholder="Company" />
                  <Button className="w-full" onClick={() => setAddCreditOpen(false)}>
                    Add Credit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Year</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Verified</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((credit) => (
                <tr key={credit.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{credit.project}</td>
                  <td className="py-3 px-4">{credit.role}</td>
                  <td className="py-3 px-4">{credit.year}</td>
                  <td className="py-3 px-4">{credit.company}</td>
                  <td className="py-3 px-4">
                    {credit.verified ? (
                      <span className="verified-badge">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <button className="unverified-badge" title="Request verification">
                        <Clock className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      
      {/* E. About */}
      <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
        <h2 className="text-xl font-display font-semibold mb-4">About</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Bio</h3>
            <p className="text-foreground">{user.bio}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Union Status</h3>
              <p className="text-foreground">{user.unionStatus || 'Not specified'}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Representation</h3>
              <p className="text-foreground">{user.representation || 'Not specified'}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Gear</h3>
              <div className="flex flex-wrap gap-2">
                {user.gearList.length > 0 ? (
                  user.gearList.map((gear, i) => (
                    <Badge key={i} variant="secondary">{gear}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">None listed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Lightbox view"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
