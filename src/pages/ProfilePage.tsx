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
import { Textarea } from '@/components/ui/textarea';
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
  Loader2,
  X,
  Save,
  Trash2,
  Award
} from 'lucide-react';
import { PublicMediaGallery } from '@/components/profile/PublicMediaGallery';
import { MediaUploader } from '@/components/profile/MediaUploader';
import { AvatarCropper } from '@/components/profile/AvatarCropper';
import { MyProjects } from '@/components/profile/MyProjects';
import { SavedProjects } from '@/components/profile/SavedProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateProfileField, PROFILE_FIELD_LIMITS } from '@/lib/profileValidation';
import { useVouch } from '@/hooks/useVouch';

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

interface Credit {
  id: string;
  user_id: string;
  project: string;
  role: string;
  year: number;
  company: string | null;
  verified: boolean;
}

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const currentUserId = useStore((s) => s.currentUserId);
  const getUser = useStore((s) => s.getUser);
  const getConnectionStatus = useStore((s) => s.getConnectionStatus);
  const sendConnectionRequest = useStore((s) => s.sendConnectionRequest);
  const getMaterials = useStore((s) => s.getMaterials);
  const updateMaterialVisibility = useStore((s) => s.updateMaterialVisibility);
  
  const [newBadge, setNewBadge] = useState('');
  const [addCreditOpen, setAddCreditOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [announced, setAnnounced] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');
  
  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isEditingPronouns, setIsEditingPronouns] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingUnionStatus, setIsEditingUnionStatus] = useState(false);
  const [isEditingRepresentation, setIsEditingRepresentation] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPronouns, setEditPronouns] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editUnionStatus, setEditUnionStatus] = useState('');
  const [editRepresentation, setEditRepresentation] = useState('');
  const [newGear, setNewGear] = useState('');
  
  // Credit form states
  const [creditProject, setCreditProject] = useState('');
  const [creditRole, setCreditRole] = useState('');
  const [creditYear, setCreditYear] = useState('');
  const [creditCompany, setCreditCompany] = useState('');
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  
  const resolvedUserId = userId === 'me' ? currentUserId : userId;
  const user = getUser(resolvedUserId || '');
  const isOwnProfile = resolvedUserId === currentUserId;
  const connectionStatus = resolvedUserId ? getConnectionStatus(resolvedUserId) : null;
  
  // Vouch hook - use actual auth user id for viewing other profiles
  const profileUserId = isOwnProfile ? authUser?.id : resolvedUserId;
  const { hasVouched, vouchCount, toggleVouch, isPending: vouchPending } = useVouch(
    !isOwnProfile ? profileUserId : undefined
  );
  
  // Media upload hooks
  const { deleteFile, updateVisibility } = useMediaUpload();
  const { fetchMedia } = useUserMedia(authUser?.id);
  
  // Fetch profile from database
  const { data: dbProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, location, pronouns, role, badges, bio, union_status, representation, gear_list, headline')
        .eq('user_id', authUser.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!authUser?.id && isOwnProfile,
  });
  
  // Fetch credits from database
  const { data: dbCredits = [], refetch: refetchCredits } = useQuery({
    queryKey: ['credits', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', authUser.id)
        .order('year', { ascending: false });
      if (error) return [];
      return data as Credit[];
    },
    enabled: !!authUser?.id && isOwnProfile,
  });
  
  // Use database values if available, otherwise fall back to store
  const displayAvatar = (isOwnProfile && dbProfile?.avatar_url) || user?.avatar;
  const displayName = (isOwnProfile && dbProfile?.display_name) || user?.name || '';
  const displayLocation = (isOwnProfile && dbProfile?.location) || user?.location || '';
  const displayRole = (isOwnProfile && dbProfile?.role) || user?.role || '';
  const displayPronouns = (isOwnProfile && dbProfile?.pronouns) || user?.pronouns || '';
  const displayBadges = (isOwnProfile && dbProfile?.badges) || user?.badges || [];
  const displayBio = (isOwnProfile && dbProfile?.bio) || user?.bio || '';
  const displayUnionStatus = (isOwnProfile && dbProfile?.union_status) || user?.unionStatus || '';
  const displayRepresentation = (isOwnProfile && dbProfile?.representation) || user?.representation || '';
  const displayGearList = (isOwnProfile && dbProfile?.gear_list) || user?.gearList || [];
  const displayCredits = isOwnProfile ? dbCredits : [];
  
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
  
  useEffect(() => {
    setAnnounced(false);
    if (!isOwnProfile && resolvedUserId) {
      // Track engagement for the authenticated user viewing this profile
      updateEngagement('profile_views');
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

      await queryClient.invalidateQueries({ queryKey: ['profile', authUser.id] });
      toast.success('Avatar updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Cover image upload handler
  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) return;

    setUploadingCover(true);
    try {
      const fileName = `${authUser.id}/cover.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(fileName);

      // For now we store cover in a custom way - could add cover_url column later
      toast.success('Cover image updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload cover');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
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

  // Profile field save handlers with validation
  const saveProfileField = async (field: string, value: string | string[] | null) => {
    if (!authUser?.id) return false;
    
    // Validate string fields against length limits
    if (typeof value === 'string' && !validateProfileField(field, value)) {
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('user_id', authUser.id);
      
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['profile', authUser.id] });
      toast.success('Profile updated!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
      return false;
    }
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (!validateProfileField('display_name', trimmed)) return;
    const success = await saveProfileField('display_name', trimmed);
    if (success) setIsEditingName(false);
  };

  const handleSaveLocation = async () => {
    const trimmed = editLocation.trim() || null;
    if (trimmed && !validateProfileField('location', trimmed)) return;
    const success = await saveProfileField('location', trimmed);
    if (success) setIsEditingLocation(false);
  };

  const handleSaveRole = async () => {
    const trimmed = editRole.trim() || null;
    if (trimmed && !validateProfileField('role', trimmed)) return;
    const success = await saveProfileField('role', trimmed);
    if (success) setIsEditingRole(false);
  };

  const handleSavePronouns = async () => {
    const trimmed = editPronouns.trim() || null;
    if (trimmed && !validateProfileField('pronouns', trimmed)) return;
    const success = await saveProfileField('pronouns', trimmed);
    if (success) setIsEditingPronouns(false);
  };

  const handleSaveBio = async () => {
    const trimmed = editBio.trim() || null;
    if (trimmed && !validateProfileField('bio', trimmed)) return;
    const success = await saveProfileField('bio', trimmed);
    if (success) setIsEditingBio(false);
  };

  const handleSaveUnionStatus = async () => {
    const trimmed = editUnionStatus.trim() || null;
    if (trimmed && !validateProfileField('union_status', trimmed)) return;
    const success = await saveProfileField('union_status', trimmed);
    if (success) setIsEditingUnionStatus(false);
  };

  const handleSaveRepresentation = async () => {
    const trimmed = editRepresentation.trim() || null;
    if (trimmed && !validateProfileField('representation', trimmed)) return;
    const success = await saveProfileField('representation', trimmed);
    if (success) setIsEditingRepresentation(false);
  };

  const handleAddBadgeToDb = async () => {
    if (!newBadge.trim() || !authUser?.id) return;
    const normalized = newBadge.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 25);
    if (!normalized) return;
    
    const currentBadges = displayBadges || [];
    if (currentBadges.includes(normalized)) {
      toast.error('Badge already exists');
      return;
    }
    
    await saveProfileField('badges', [...currentBadges, normalized]);
    setNewBadge('');
  };

  const handleRemoveBadge = async (badgeToRemove: string) => {
    if (!authUser?.id) return;
    const currentBadges = displayBadges || [];
    const updatedBadges = currentBadges.filter(b => b !== badgeToRemove);
    await saveProfileField('badges', updatedBadges);
  };

  const handleAddGear = async () => {
    if (!newGear.trim() || !authUser?.id) return;
    const gearTrimmed = newGear.trim();
    if (gearTrimmed.length > 100) {
      toast.error('Gear item must be 100 characters or less');
      return;
    }
    const currentGear = displayGearList || [];
    if (currentGear.includes(gearTrimmed)) {
      toast.error('Gear already exists');
      return;
    }
    await saveProfileField('gear_list', [...currentGear, gearTrimmed]);
    setNewGear('');
  };

  const handleRemoveGear = async (gearToRemove: string) => {
    if (!authUser?.id) return;
    const currentGear = displayGearList || [];
    const updatedGear = currentGear.filter(g => g !== gearToRemove);
    await saveProfileField('gear_list', updatedGear);
  };

  // Credit handlers
  const handleAddCredit = async () => {
    if (!creditProject.trim() || !creditRole.trim() || !creditYear || !authUser?.id) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('credits')
        .insert({
          user_id: authUser.id,
          project: creditProject.trim(),
          role: creditRole.trim(),
          year: parseInt(creditYear),
          company: creditCompany.trim() || null,
          verified: false
        });
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['credits', authUser.id] });
      toast.success('Credit added!');
      setCreditProject('');
      setCreditRole('');
      setCreditYear('');
      setCreditCompany('');
      setAddCreditOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add credit');
    }
  };

  const handleUpdateCredit = async (creditId: string, updates: Partial<Credit>) => {
    if (!authUser?.id) return;
    
    try {
      const { error } = await supabase
        .from('credits')
        .update(updates)
        .eq('id', creditId)
        .eq('user_id', authUser.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['credits', authUser.id] });
      toast.success('Credit updated!');
      setEditingCreditId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update credit');
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (!authUser?.id) return;
    
    try {
      const { error } = await supabase
        .from('credits')
        .delete()
        .eq('id', creditId)
        .eq('user_id', authUser.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['credits', authUser.id] });
      toast.success('Credit deleted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete credit');
    }
  };

  const startEditingName = () => {
    setEditName(displayName);
    setIsEditingName(true);
  };

  const startEditingLocation = () => {
    setEditLocation(displayLocation);
    setIsEditingLocation(true);
  };

  const startEditingRole = () => {
    setEditRole(displayRole);
    setIsEditingRole(true);
  };

  const startEditingPronouns = () => {
    setEditPronouns(displayPronouns);
    setIsEditingPronouns(true);
  };

  const startEditingBio = () => {
    setEditBio(displayBio);
    setIsEditingBio(true);
  };

  const startEditingUnionStatus = () => {
    setEditUnionStatus(displayUnionStatus);
    setIsEditingUnionStatus(true);
  };

  const startEditingRepresentation = () => {
    setEditRepresentation(displayRepresentation);
    setIsEditingRepresentation(true);
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
          
          {/* Cover edit button */}
          {isOwnProfile && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleCoverSelect}
                className="hidden"
              />
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute top-4 right-4 p-2 rounded-full bg-card/80 backdrop-blur-sm shadow-lg hover:bg-card transition-colors disabled:opacity-50"
                aria-label="Change cover image"
              >
                {uploadingCover ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>
            </>
          )}
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
              {/* Editable Name */}
              {isOwnProfile && isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl sm:text-3xl font-display font-bold h-auto py-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveName}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 
                    className={`text-2xl sm:text-3xl font-display font-bold ${isOwnProfile ? 'cursor-pointer hover:text-primary transition-colors group' : ''}`}
                    onClick={isOwnProfile ? startEditingName : undefined}
                  >
                    {displayName || 'Add your name'}
                    {isOwnProfile && <Pencil className="w-4 h-4 inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </h1>
                  {/* Vouch count badge */}
                  {vouchCount > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Award className="w-4 h-4" />
                      <span className="text-sm font-medium">{vouchCount}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Editable Role, Location, Pronouns */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Role Badge */}
                {isOwnProfile && isEditingRole ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-24 h-7 text-sm"
                      placeholder="Role"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRole()}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveRole}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingRole(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Badge 
                    variant="secondary" 
                    className={`text-sm font-medium ${isOwnProfile ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
                    onClick={isOwnProfile ? startEditingRole : undefined}
                  >
                    {displayRole || 'Add role'}
                    {isOwnProfile && <Pencil className="w-3 h-3 ml-1 inline" />}
                  </Badge>
                )}

                {/* Location */}
                {isOwnProfile && isEditingLocation ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-32 h-7 text-sm"
                      placeholder="Location"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveLocation()}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveLocation}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingLocation(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className={`text-muted-foreground text-sm ${isOwnProfile ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}
                    onClick={isOwnProfile ? startEditingLocation : undefined}
                  >
                    {displayLocation || (isOwnProfile ? 'Add location' : '')}
                    {isOwnProfile && <Pencil className="w-3 h-3 ml-1 inline" />}
                  </span>
                )}

                {/* Pronouns */}
                {isOwnProfile && isEditingPronouns ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editPronouns}
                      onChange={(e) => setEditPronouns(e.target.value)}
                      className="w-24 h-7 text-sm"
                      placeholder="Pronouns"
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePronouns()}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSavePronouns}>
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingPronouns(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className={`text-muted-foreground text-sm ${isOwnProfile ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}
                    onClick={isOwnProfile ? startEditingPronouns : undefined}
                  >
                    ({displayPronouns || (isOwnProfile ? 'Add pronouns' : '')})
                    {isOwnProfile && <Pencil className="w-3 h-3 ml-1 inline" />}
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {!isOwnProfile && authUser && (
                <>
                  {/* Vouch Button */}
                  <Button
                    variant={hasVouched ? "default" : "outline"}
                    size="sm"
                    onClick={toggleVouch}
                    disabled={vouchPending}
                    className={hasVouched ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                  >
                    <Award className="w-4 h-4 mr-1" />
                    {hasVouched ? 'Vouched' : 'Vouch'}
                  </Button>
                  
                  {/* Connect/Message Button */}
                  <button
                    onClick={connectionStatus === 'accepted' ? handleMessage : handleConnect}
                    disabled={connectionStatus === 'pending'}
                    className={getConnectButtonClass()}
                    aria-label={getConnectButtonLabel() || undefined}
                  >
                    {getConnectButtonLabel()}
                  </button>
                </>
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
          {displayBadges.map((badge) => (
            <div key={badge} className="relative group flex-shrink-0">
              <button
                onClick={() => handleBadgeClick(badge)}
                className="badge-pill"
              >
                #{badge}
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => handleRemoveBadge(badge)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${badge} badge`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          
          {isOwnProfile && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Input
                type="text"
                placeholder="Add badge..."
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBadgeToDb()}
                className="w-32 h-8 text-sm"
                maxLength={25}
              />
              <Button 
                size="sm" 
                onClick={handleAddBadgeToDb}
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
                  <Input 
                    placeholder="Project title *" 
                    value={creditProject}
                    onChange={(e) => setCreditProject(e.target.value)}
                  />
                  <Input 
                    placeholder="Role *" 
                    value={creditRole}
                    onChange={(e) => setCreditRole(e.target.value)}
                  />
                  <Input 
                    placeholder="Year *" 
                    type="number" 
                    value={creditYear}
                    onChange={(e) => setCreditYear(e.target.value)}
                  />
                  <Input 
                    placeholder="Company" 
                    value={creditCompany}
                    onChange={(e) => setCreditCompany(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleAddCredit}>
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
                {isOwnProfile && <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayCredits.map((credit) => (
                <tr key={credit.id} className="border-b border-border/50 hover:bg-muted/50 group">
                  <td className="py-3 px-4 font-medium">{credit.project}</td>
                  <td className="py-3 px-4">{credit.role}</td>
                  <td className="py-3 px-4">{credit.year}</td>
                  <td className="py-3 px-4">{credit.company || '-'}</td>
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
                  {isOwnProfile && (
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteCredit(credit.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {displayCredits.length === 0 && (
                <tr>
                  <td colSpan={isOwnProfile ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    {isOwnProfile ? 'No credits yet. Add your first credit!' : 'No credits listed.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* My Projects */}
      {resolvedUserId && (
        <MyProjects userId={resolvedUserId} isOwnProfile={isOwnProfile} />
      )}
      
      {/* Saved Projects (only visible on own profile) */}
      {isOwnProfile && <SavedProjects />}
      
      {/* E. About */}
      <section className="px-4 sm:px-6 lg:px-8 py-6 border-t border-border">
        <h2 className="text-xl font-display font-semibold mb-4">About</h2>
        
        <div className="space-y-6">
          {/* Bio */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Bio</h3>
            {isOwnProfile && isEditingBio ? (
              <div className="space-y-2">
                <Textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Tell us about yourself..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveBio}>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingBio(false)}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p 
                className={`text-foreground ${isOwnProfile ? 'cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded transition-colors' : ''}`}
                onClick={isOwnProfile ? startEditingBio : undefined}
              >
                {displayBio || (isOwnProfile ? 'Click to add your bio...' : 'No bio provided.')}
                {isOwnProfile && <Pencil className="w-4 h-4 inline ml-2 opacity-50" />}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Union Status */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Union Status</h3>
              {isOwnProfile && isEditingUnionStatus ? (
                <div className="space-y-2">
                  <Input
                    value={editUnionStatus}
                    onChange={(e) => setEditUnionStatus(e.target.value)}
                    placeholder="e.g., SAG-AFTRA, AEA, Non-Union"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveUnionStatus}>
                      <Save className="w-4 h-4 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingUnionStatus(false)}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p 
                  className={`text-foreground ${isOwnProfile ? 'cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded transition-colors' : ''}`}
                  onClick={isOwnProfile ? startEditingUnionStatus : undefined}
                >
                  {displayUnionStatus || (isOwnProfile ? 'Click to add...' : 'Not specified')}
                  {isOwnProfile && <Pencil className="w-4 h-4 inline ml-2 opacity-50" />}
                </p>
              )}
            </div>
            
            {/* Representation */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Representation</h3>
              {isOwnProfile && isEditingRepresentation ? (
                <div className="space-y-2">
                  <Input
                    value={editRepresentation}
                    onChange={(e) => setEditRepresentation(e.target.value)}
                    placeholder="e.g., Agency name"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveRepresentation}>
                      <Save className="w-4 h-4 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingRepresentation(false)}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p 
                  className={`text-foreground ${isOwnProfile ? 'cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded transition-colors' : ''}`}
                  onClick={isOwnProfile ? startEditingRepresentation : undefined}
                >
                  {displayRepresentation || (isOwnProfile ? 'Click to add...' : 'Not specified')}
                  {isOwnProfile && <Pencil className="w-4 h-4 inline ml-2 opacity-50" />}
                </p>
              )}
            </div>
            
            {/* Gear */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Gear</h3>
              <div className="flex flex-wrap gap-2">
                {displayGearList.length > 0 ? (
                  displayGearList.map((gear, i) => (
                    <div key={i} className="relative group">
                      <Badge variant="secondary">{gear}</Badge>
                      {isOwnProfile && (
                        <button
                          onClick={() => handleRemoveGear(gear)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${gear}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground">{isOwnProfile ? 'Add your gear...' : 'None listed'}</span>
                )}
                
                {isOwnProfile && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newGear}
                      onChange={(e) => setNewGear(e.target.value)}
                      placeholder="Add gear"
                      className="w-24 h-7 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddGear()}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddGear}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
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
