import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { safeBack } from "@/lib/safeBack";
import { useStore, User, Visibility } from "../store/useStore";
import { useTrackProfileView, useUpdateEngagement } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useMediaUpload, useUserMedia } from "@/hooks/useMediaUpload";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, capitalizeName } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  ChevronDown,
  Pencil,
  Camera,
  Loader2,
  X,
  Save,
  Trash2,
  Award,
  Calendar,
  Briefcase,
  MessageSquare,
  FolderKanban,
  Instagram,
  Globe,
  Link as LinkIcon,
  GraduationCap,
  Bookmark,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PublicMediaGallery } from "@/components/profile/PublicMediaGallery";
import { WhyIStarted } from "@/components/profile/WhyIStarted";
import { MediaUploader } from "@/components/profile/MediaUploader";
import { AvatarCropper } from "@/components/profile/AvatarCropper";
import { CoverImageCropper } from "@/components/profile/CoverImageCropper";
import { MyProjects } from "@/components/profile/MyProjects";
import { UserPosts } from "@/components/profile/UserPosts";
import { AttendedSection } from "@/components/profile/AttendedSection";
import { AddAttendedDialog } from "@/components/profile/AddAttendedDialog";
import { SavedProjects } from "@/components/profile/SavedProjects";
import { supabase } from "@/integrations/supabase/client";
import { PostCreator, PostType } from "@/components/feed/PostCreator";
import { ProjectCreator } from "@/components/projects/ProjectCreator";
import { GradYearDialog } from "@/components/profile/GradYearDialog";
import { toast } from "sonner";
import { validateProfileField, PROFILE_FIELD_LIMITS } from "@/lib/profileValidation";
import { useVouch } from "@/hooks/useVouch";
import { useNetworkConnections } from "@/hooks/useNetworkConnections";
import { useConnectionRequests } from "@/hooks/useConnectionRequests";
import { VerifyCreditsDialog } from "@/components/profile/VerifyCreditsDialog";
import { CreditRow } from "@/components/profile/CreditRow";
import { VouchDialog } from "@/components/profile/VouchDialog";
import { SkillsCombobox } from "@/components/ui/skills-combobox";
import { RequestCompanyAccountDialog } from "@/components/profile/RequestCompanyAccountDialog";
import { LocationCombobox } from "@/components/ui/location-combobox";
import ProfileCompletionBar from "@/components/profile/ProfileCompletionBar";
import FloatingChatButton from "@/components/messages/FloatingChatButton";
import { useMinimizedChat } from "@/hooks/useMinimizedChat";
import { useLocation } from "react-router-dom";
import inlightLogo from "@/assets/inlight-logo.jpeg";

type MediaType = "photo" | "video" | "audio" | "document";
type MediaVisibility = "public" | "connections" | "private";
type ProfileSectionKey = "materials" | "credits" | "attended" | "projects" | "posts";

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

interface ProfileData {
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  role: string | null;
  badges: string[] | null;
  bio: string | null;
  union_status: string | null;
  representation: string | null;
  gear_list: string[] | null;
  headline: string | null;
  user_id: string;
  skills: string[] | null;
  instagram_url: string | null;
  website_url: string | null;
  graduation_status: string | null;
  graduation_year: number | null;
  show_union_status?: boolean;
  show_representation?: boolean;
  show_gear_list?: boolean;
}

class ProfileSectionErrorBoundary extends React.Component<
  { title: string; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { title: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(`[ProfileSection:${this.props.title}] render failed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
          Some {this.props.title.toLowerCase()} information could not be displayed yet.
          {this.state.message ? <div className="mt-1 text-xs opacity-70">({this.state.message})</div> : null}
        </div>
      );
    }

    return this.props.children;
  }
}

class ProfilePageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string; stack?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    const componentStack =
      typeof info === "object" && info !== null && "componentStack" in info
        ? String((info as { componentStack?: unknown }).componentStack ?? "")
        : "";

    console.error("[ProfilePage] top-level render failure:", error, info);
    if (componentStack) {
      console.error("[ProfilePage] component stack text:\n" + componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold">This profile couldn't load</h2>
            <p className="text-sm text-muted-foreground">
              Something on this profile failed to render. Other profiles may still work.
            </p>
            {this.state.message ? (
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.message}
              </pre>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/people";
              }}
            >
              Back to People
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isMinimized: chatMinimized,
    originRoute: chatOriginRoute,
    chatRoute,
    close: closeChat,
    expand: expandChat,
  } = useMinimizedChat();
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

  const [newBadge, setNewBadge] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [addCreditOpen, setAddCreditOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [announced, setAnnounced] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState("");
  const [coverCropperOpen, setCoverCropperOpen] = useState(false);
  const [coverCropperImageSrc, setCoverCropperImageSrc] = useState("");

  // Post creator states
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [defaultPostType, setDefaultPostType] = useState<PostType>("update");
  const [showProjectCreator, setShowProjectCreator] = useState(false);

  // Collapsible section states are initialized from each section's content.
  // Removed detailsOpen - Details section moved to settings
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const [attendedOpen, setAttendedOpen] = useState(false);
  const sectionDefaultsProfileRef = useRef<string | null>(null);
  const manuallyChangedSectionsRef = useRef<Record<ProfileSectionKey, boolean>>({
    materials: false,
    credits: false,
    attended: false,
    projects: false,
    posts: false,
  });

  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [isEditingStageName, setIsEditingStageName] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editBio, setEditBio] = useState("");
  const [isEditingInstagram, setIsEditingInstagram] = useState(false);
  const [isEditingWebsite, setIsEditingWebsite] = useState(false);
  const [editInstagram, setEditInstagram] = useState("");
  const [editWebsite, setEditWebsite] = useState("");

  // Credit form states
  const [creditProject, setCreditProject] = useState("");
  const [creditRole, setCreditRole] = useState("");
  const [creditYear, setCreditYear] = useState("");
  const [creditCompany, setCreditCompany] = useState("");
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);

  const resolvedUserId = userId === "me" ? authUser?.id || currentUserId : userId;
  const isOwnProfile = resolvedUserId === authUser?.id;
  const connectionStatus = resolvedUserId ? getConnectionStatus(resolvedUserId) : null;

  // Vouch hook - use actual auth user id for viewing other profiles
  const profileUserId = isOwnProfile ? authUser?.id : resolvedUserId;
  const {
    hasVouched,
    vouchCount,
    vouch,
    unvouch,
    isPending: vouchPending,
  } = useVouch(!isOwnProfile ? profileUserId : undefined);
  const [vouchDialogOpen, setVouchDialogOpen] = useState(false);

  // Follow/connection hooks
  const { isFollowing, follow, unfollow, isFollowPending, isUnfollowPending, isMutual } = useNetworkConnections();
  const { sendRequest, hasSentRequestTo, sentRequests, cancelRequest } = useConnectionRequests();

  const userIsFollowing = resolvedUserId ? isFollowing(resolvedUserId) : false;
  const hasPendingRequest = resolvedUserId ? hasSentRequestTo(resolvedUserId) : false;

  // Get pending request ID for this user
  const pendingRequestId = resolvedUserId
    ? sentRequests.find((r) => r.receiver_id === resolvedUserId && r.status === "pending")?.id
    : undefined;
  const isConnected = resolvedUserId ? isMutual(resolvedUserId) : false;

  // Fetch network counts for this profile (connections only)
  const { data: networkCounts } = useQuery({
    queryKey: ["network-counts", resolvedUserId],
    queryFn: async () => {
      if (!resolvedUserId) return { networkCount: 0 };

      // Get mutual connections count (1st degree / network)
      const { data: mutualData, error: mutualError } = await supabase.rpc("get_mutual_connections", {
        target_user_id: resolvedUserId,
      });

      if (mutualError) console.error("Error fetching mutual connections:", mutualError);

      return {
        networkCount: mutualData?.length || 0,
      };
    },
    enabled: !!resolvedUserId,
  });

  // Media upload hooks
  const { deleteFile, updateVisibility } = useMediaUpload();
  const { fetchMedia } = useUserMedia(authUser?.id);

  // Fetch profile from database - for own profile use profiles table, for others use profiles_public view
  const {
    data: dbProfile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery<ProfileData | null>({
    queryKey: ["profile", resolvedUserId, isOwnProfile],
    queryFn: async (): Promise<ProfileData | null> => {
      if (!resolvedUserId) return null;

      if (isOwnProfile) {
        // Own profile - use full profiles table
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "display_name, stage_name, avatar_url, cover_url, location, role, badges, bio, union_status, representation, gear_list, headline, user_id, skills, instagram_url, website_url, graduation_status, graduation_year, show_union_status, show_representation, show_gear_list",
          )
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        if (error) {
          console.error("Failed loading own profile:", error);
          return null;
        }
        return data as ProfileData | null;
      } else {
        // Other users - use public view (excludes email)
        const { data, error } = await supabase
          .from("profiles_public")
          .select(
            "display_name, stage_name, avatar_url, cover_url, location, role, badges, bio, union_status, representation, gear_list:gear_list_display, headline, user_id, skills, instagram_url, website_url, graduation_status, graduation_year, show_union_status, show_representation, show_gear_list",
          )
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        if (error) {
          console.error("Failed loading public profile:", error);
          return null;
        }
        return data as unknown as ProfileData | null;
      }
    },
    enabled: !!resolvedUserId,
  });

  // Fetch credits from database - for any user
  const { data: dbCredits = [], refetch: refetchCredits } = useQuery({
    queryKey: ["credits", resolvedUserId],
    queryFn: async () => {
      if (!resolvedUserId) return [];
      const { data, error } = await supabase
        .from("credits")
        .select("*")
        .eq("user_id", resolvedUserId)
        .order("year", { ascending: false });
      if (error) return [];
      return data as Credit[];
    },
    enabled: !!resolvedUserId,
  });

  // Use database values - fall back to store only as last resort for legacy data
  const user = getUser(resolvedUserId || "");
  const displayAvatar = dbProfile?.avatar_url || user?.avatar;
  const displayName = capitalizeName(dbProfile?.display_name || user?.name || "");
  const displayStageName = capitalizeName(dbProfile?.stage_name || "");
  const displayLocation = dbProfile?.location || user?.location || "";
  const displayRole = dbProfile?.role || user?.role || "";
  // Parse roles from comma-separated string into array (max 4 roles)
  const displayRoles = displayRole
    ? displayRole
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const displayBadges = dbProfile?.badges || user?.badges || [];
  const displayBio = dbProfile?.bio || user?.bio || "";
  const displayUnionStatus = dbProfile?.union_status || user?.unionStatus || "";
  const displayRepresentation = dbProfile?.representation || user?.representation || "";
  const displayGearList = dbProfile?.gear_list || user?.gearList || [];
  const displaySkills = dbProfile?.skills || [];
  const displayInstagram = dbProfile?.instagram_url || "";
  const displayWebsite = dbProfile?.website_url || "";
  const displayGraduationStatus = dbProfile?.graduation_status || null;
  const displayGraduationYear = dbProfile?.graduation_year || null;
  const displayCredits = (dbCredits || []).filter((credit): credit is Credit => Boolean(credit?.id));

  const { data: sectionContent } = useQuery({
    queryKey: ["profile-section-content", resolvedUserId, isOwnProfile, connectionStatus],
    queryFn: async () => {
      if (!resolvedUserId) {
        return {
          materials: false,
          whyStarted: false,
          credits: false,
          attended: false,
          projects: false,
          posts: false,
        };
      }

      const [
        mediaRes,
        whyAnswersRes,
        creditsRes,
        ownedProjectsRes,
        memberProjectsRes,
        savedProjectsRes,
        postsRes,
        eventsRes,
        attendanceRes,
      ] = await Promise.all([
        (() => {
          let query = supabase.from("user_media").select("id").eq("user_id", resolvedUserId).limit(1);

          if (!isOwnProfile) {
            query =
              connectionStatus === "accepted"
                ? query.in("visibility", ["public", "connections"])
                : query.eq("visibility", "public");
          }

          return query;
        })(),
        supabase
          .from("profiles_public")
          .select("favorite_movie, favorite_artist, favorite_song, why_artist")
          .eq("user_id", resolvedUserId)
          .maybeSingle(),
        supabase.from("credits").select("id").eq("user_id", resolvedUserId).limit(1),
        supabase.from("projects").select("id").eq("creator_id", resolvedUserId).limit(100),
        supabase.from("project_members").select("project_id").eq("user_id", resolvedUserId).limit(1),
        isOwnProfile
          ? supabase.from("saved_projects").select("project_id").eq("user_id", resolvedUserId).limit(1)
          : Promise.resolve({ data: [] as Array<{ project_id: string | null }> }),
        supabase.from("posts").select("id").eq("user_id", resolvedUserId).limit(1),
        supabase.from("events").select("id").eq("user_id", resolvedUserId).limit(1),
        supabase.rpc("get_profile_attendance", { _user_id: resolvedUserId }),
      ]);

      const ownedProjectIds = (ownedProjectsRes.data || []).map((project) => project.id).filter(Boolean);
      const openRolesRes =
        ownedProjectIds.length > 0
          ? await supabase
              .from("project_roles")
              .select("id")
              .in("project_id", ownedProjectIds)
              .is("assigned_user_id", null)
              .limit(1)
          : { data: [] as Array<{ id: string }> };

      const whyAnswers = whyAnswersRes.data
        ? Object.values(whyAnswersRes.data).some((answer) => typeof answer === "string" && answer.trim())
        : false;

      return {
        materials: Boolean((mediaRes.data || []).length || whyAnswers),
        whyStarted: whyAnswers,
        credits: Boolean((creditsRes.data || []).length),
        attended: Boolean((attendanceRes.data || []).length),
        projects: Boolean(
          ownedProjectIds.length || (memberProjectsRes.data || []).length || (savedProjectsRes.data || []).length,
        ),
        posts: Boolean(
          (postsRes.data || []).length || (eventsRes.data || []).length || (openRolesRes.data || []).length,
        ),
      };
    },
    enabled: !!resolvedUserId,
  });

  useEffect(() => {
    if (isOwnProfile || !resolvedUserId) return;

    console.groupCollapsed("[ProfileDebug] public profile snapshot");
    console.log("routeUserId", userId);
    console.log("resolvedUserId", resolvedUserId);
    console.log("authUserId", authUser?.id ?? null);
    console.log("currentUserId", currentUserId ?? null);
    console.log("isOwnProfile", isOwnProfile);
    console.log(
      "dbProfile",
      dbProfile
        ? {
            user_id: dbProfile.user_id,
            display_name: dbProfile.display_name,
            badgesCount: dbProfile.badges?.length ?? 0,
            skillsCount: dbProfile.skills?.length ?? 0,
            gearListCount: dbProfile.gear_list?.length ?? 0,
            show_union_status: dbProfile.show_union_status ?? null,
            show_representation: dbProfile.show_representation ?? null,
            show_gear_list: dbProfile.show_gear_list ?? null,
          }
        : null,
    );
    console.log(
      "fallbackStoreUser",
      user
        ? {
            id: user.id,
            name: user.name,
            role: user.role,
          }
        : null,
    );
    console.log("networkCounts", networkCounts ?? null);
    console.log("connectionStatus", connectionStatus ?? null);
    console.log("hasPendingRequest", hasPendingRequest);
    console.log("pendingRequestId", pendingRequestId ?? null);
    console.log("vouchCount", vouchCount);
    console.log("hasVouched", hasVouched);
    console.log("displayCreditsCount", displayCredits.length);
    console.log("displayBadges", displayBadges);
    console.log("displaySkills", displaySkills);
    console.groupEnd();
  }, [
    isOwnProfile,
    resolvedUserId,
    userId,
    authUser?.id,
    currentUserId,
    dbProfile,
    user,
    networkCounts,
    connectionStatus,
    hasPendingRequest,
    pendingRequestId,
    vouchCount,
    hasVouched,
    displayCredits.length,
    displayBadges,
    displaySkills,
  ]);

  // Fetch user media from database
  const { data: userMedia = [], refetch: refetchMedia } = useQuery({
    queryKey: ["user-media", authUser?.id],
    queryFn: fetchMedia,
    enabled: !!authUser?.id && isOwnProfile,
  });

  // Filter media by type
  const uploadedPhotos = userMedia.filter((m) => m.file_type === "photo") as MediaItem[];
  const uploadedVideos = userMedia.filter((m) => m.file_type === "video") as MediaItem[];
  const uploadedAudio = userMedia.filter((m) => m.file_type === "audio") as MediaItem[];
  const uploadedDocuments = userMedia.filter((m) => m.file_type === "document") as MediaItem[];

  // Track profile view when visiting someone else's profile
  useTrackProfileView(resolvedUserId || "");
  const { updateEngagement } = useUpdateEngagement();

  const materials = resolvedUserId ? getMaterials(resolvedUserId) : [];

  // Clear minimized chat state if we're not the origin page
  useEffect(() => {
    if (chatMinimized && chatOriginRoute !== location.pathname) {
      closeChat();
    }
  }, [chatMinimized, chatOriginRoute, location.pathname, closeChat]);

  useEffect(() => {
    sectionDefaultsProfileRef.current = null;
    manuallyChangedSectionsRef.current = {
      materials: false,
      credits: false,
      attended: false,
      projects: false,
      posts: false,
    };
    setMaterialsOpen(false);
    setCreditsOpen(false);
    setAttendedOpen(false);
    setProjectsOpen(false);
    setPostsOpen(false);
  }, [resolvedUserId]);

  useEffect(() => {
    if (!resolvedUserId || !sectionContent || sectionDefaultsProfileRef.current === resolvedUserId) return;

    sectionDefaultsProfileRef.current = resolvedUserId;

    if (!manuallyChangedSectionsRef.current.materials) setMaterialsOpen(sectionContent.materials);
    if (!manuallyChangedSectionsRef.current.credits) setCreditsOpen(sectionContent.credits);
    if (!manuallyChangedSectionsRef.current.attended) setAttendedOpen(sectionContent.attended);
    if (!manuallyChangedSectionsRef.current.projects) setProjectsOpen(sectionContent.projects);
    if (!manuallyChangedSectionsRef.current.posts) setPostsOpen(sectionContent.posts);
  }, [resolvedUserId, sectionContent]);

  const handleSectionOpenChange =
    (section: ProfileSectionKey, setOpen: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
      manuallyChangedSectionsRef.current[section] = true;
      setOpen(open);
    };

  useEffect(() => {
    setAnnounced(false);
    if (!isOwnProfile && resolvedUserId) {
      // Track engagement for the authenticated user viewing this profile
      updateEngagement("profile_views");
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
      avatarInputRef.current.value = "";
    }
  };

  const handleCroppedAvatarUpload = async (blob: Blob) => {
    setUploadingAvatar(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const ownerId = authData.user?.id;
      if (!ownerId) {
        throw new Error("You must be signed in to update your profile picture.");
      }

      const fileName = `${ownerId}/avatars/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from("profile-media").upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("profile-media").getPublicUrl(fileName);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("user_id", ownerId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ["profile", ownerId] });
      toast.success("Avatar updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCoverCropperImageSrc(reader.result as string);
      setCoverCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
  };

  // Cover image upload handler
  const handleCroppedCoverUpload = async (blob: Blob) => {
    setUploadingCover(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const ownerId = authData.user?.id;
      if (!ownerId) {
        throw new Error("You must be signed in to update your cover image.");
      }

      const fileName = `${ownerId}/covers/cover-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from("profile-media").upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("profile-media").getPublicUrl(fileName);

      const newCoverUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Save the cover URL to the database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: newCoverUrl })
        .eq("user_id", ownerId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ["profile", ownerId] });
      toast.success("Cover image updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload cover");
    } finally {
      setUploadingCover(false);
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
    if (typeof value === "string" && !validateProfileField(field, value)) {
      return false;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value } as any)
        .eq("user_id", authUser.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", authUser.id] });
      toast.success("Profile updated!");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
      return false;
    }
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (!validateProfileField("display_name", trimmed)) return;
    const success = await saveProfileField("display_name", trimmed);
    if (success) setIsEditingName(false);
  };

  const startEditingStageName = () => {
    setEditStageName(displayStageName);
    setIsEditingStageName(true);
  };

  const handleSaveStageName = async () => {
    const trimmed = editStageName.trim() || null;
    const success = await saveProfileField("stage_name", trimmed);
    if (success) setIsEditingStageName(false);
  };

  const handleSaveLocation = async () => {
    const trimmed = editLocation.trim() || null;
    if (trimmed && !validateProfileField("location", trimmed)) return;
    const success = await saveProfileField("location", trimmed);
    if (success) setIsEditingLocation(false);
  };

  const handleSaveRole = async () => {
    const trimmed = editRole.trim() || null;
    if (trimmed && !validateProfileField("role", trimmed)) return;
    // Parse and validate max 4 roles
    if (trimmed) {
      const roles = trimmed
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (roles.length > 4) {
        toast.error("Maximum 4 roles allowed");
        return;
      }
    }
    const success = await saveProfileField("role", trimmed);
    if (success) setIsEditingRole(false);
  };

  const handleAddRole = async (newRole: string) => {
    if (!authUser?.id || !newRole.trim()) return;
    const currentRoles = displayRoles;
    if (currentRoles.length >= 4) {
      toast.error("Maximum 4 roles allowed");
      return;
    }
    if (currentRoles.includes(newRole.trim())) {
      toast.error("Role already exists");
      return;
    }
    const updatedRoles = [...currentRoles, newRole.trim()].join(", ");
    await saveProfileField("role", updatedRoles);
  };

  const handleRemoveRole = async (roleToRemove: string) => {
    if (!authUser?.id) return;
    const updatedRoles = displayRoles.filter((r) => r !== roleToRemove).join(", ") || null;
    await saveProfileField("role", updatedRoles);
  };

  const handleSaveBio = async () => {
    const trimmed = editBio.trim() || null;
    if (trimmed && !validateProfileField("bio", trimmed)) return;
    const success = await saveProfileField("bio", trimmed);
    if (success) setIsEditingBio(false);
  };

  // Union status, representation, gear handlers removed - now managed in settings

  const handleSaveInstagram = async () => {
    const trimmed = editInstagram.trim() || null;
    const success = await saveProfileField("instagram_url", trimmed);
    if (success) setIsEditingInstagram(false);
  };

  const handleSaveWebsite = async () => {
    const trimmed = editWebsite.trim() || null;
    const success = await saveProfileField("website_url", trimmed);
    if (success) setIsEditingWebsite(false);
  };

  const startEditingInstagram = () => {
    setEditInstagram(displayInstagram);
    setIsEditingInstagram(true);
  };

  const startEditingWebsite = () => {
    setEditWebsite(displayWebsite);
    setIsEditingWebsite(true);
  };

  const handleSaveGradYear = async (status: string, year: number): Promise<boolean> => {
    if (!authUser?.id) return false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ graduation_status: status, graduation_year: year })
        .eq("user_id", authUser.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", authUser.id] });
      toast.success("Graduation year updated!");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to update graduation year");
      return false;
    }
  };

  const handleClearGradYear = async (): Promise<boolean> => {
    if (!authUser?.id) return false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ graduation_status: null, graduation_year: null })
        .eq("user_id", authUser.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", authUser.id] });
      toast.success("Graduation year cleared");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to clear graduation year");
      return false;
    }
  };

  // Studio badge options for the dropdown
  const studioBadgeOptions = [
    { tag: "etw", label: "Experimental Theatre Wing" },
    { tag: "nsb", label: "New Studio on Broadway" },
    { tag: "atlantic", label: "Atlantic" },
    { tag: "classical", label: "Classical" },
    { tag: "stonestreet", label: "Stonestreet" },
    { tag: "gradacting", label: "Graduate Acting" },
    { tag: "playwrights", label: "Playwrights" },
    { tag: "adler", label: "Stella Adler" },
    { tag: "meisner", label: "Meisner" },
    { tag: "innovation", label: "The Innovation Studio" },
    { tag: "strasberg", label: "Strasberg" },
    { tag: "UGFTV", label: "Film and TV" },
    { tag: "p&d", label: "Production and Design" },
    { tag: "cinemastudies", label: "Cinema Studies" },
    { tag: "recordedmusic", label: "Clive Davis Institute" },
    { tag: "photography", label: "Photography" },
    { tag: "collabarts", label: "Collaborative Arts" },
    { tag: "dance", label: "Dance" },
  ];

  const handleAddBadgeToDb = async (badgeTag?: string) => {
    const tagToAdd = badgeTag || newBadge.trim();
    if (!tagToAdd || !authUser?.id) return;
    const normalized = tagToAdd
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 25);
    if (!normalized) return;

    const currentBadges = displayBadges || [];
    if (currentBadges.includes(normalized)) {
      toast.error("Badge already exists");
      return;
    }

    await saveProfileField("badges", [...currentBadges, normalized]);
    setNewBadge("");
  };

  const handleRemoveBadge = async (badgeToRemove: string) => {
    if (!authUser?.id) return;
    const currentBadges = displayBadges || [];
    const updatedBadges = currentBadges.filter((b) => b !== badgeToRemove);
    await saveProfileField("badges", updatedBadges);
  };

  // Gear handlers removed - now managed in settings

  // Skills handlers
  const handleAddSkill = async () => {
    if (!newSkill.trim() || !authUser?.id) return;
    const skillTrimmed = newSkill.trim();
    if (skillTrimmed.length > 50) {
      toast.error("Skill must be 50 characters or less");
      return;
    }
    const currentSkills = displaySkills || [];
    if (currentSkills.some((s) => s.toLowerCase() === skillTrimmed.toLowerCase())) {
      toast.error("Skill already exists");
      return;
    }
    await saveProfileField("skills", [...currentSkills, skillTrimmed]);
    setNewSkill("");
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    if (!authUser?.id) return;
    const currentSkills = displaySkills || [];
    const updatedSkills = currentSkills.filter((s) => s !== skillToRemove);
    await saveProfileField("skills", updatedSkills);
  };

  // Credit handlers
  const handleAddCredit = async () => {
    if (!creditProject.trim() || !creditRole.trim() || !creditYear || !authUser?.id) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      const { error } = await supabase.from("credits").insert({
        user_id: authUser.id,
        project: creditProject.trim(),
        role: creditRole.trim(),
        year: parseInt(creditYear),
        company: creditCompany.trim() || null,
        verified: false,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["credits", authUser.id] });
      toast.success("Credit added!");
      setCreditProject("");
      setCreditRole("");
      setCreditYear("");
      setCreditCompany("");
      setAddCreditOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add credit");
    }
  };

  const handleUpdateCredit = async (creditId: string, updates: Partial<Credit>) => {
    if (!authUser?.id) return;

    try {
      const { error } = await supabase.from("credits").update(updates).eq("id", creditId).eq("user_id", authUser.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["credits", authUser.id] });
      toast.success("Credit updated!");
      setEditingCreditId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update credit");
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (!authUser?.id) return;

    try {
      const { error } = await supabase.from("credits").delete().eq("id", creditId).eq("user_id", authUser.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["credits", authUser.id] });
      toast.success("Credit deleted!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete credit");
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

  const startEditingBio = () => {
    setEditBio(displayBio);
    setIsEditingBio(true);
  };

  // Union status and representation editing functions removed - now managed in settings

  // Loading state
  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-2">Loading profile...</p>
      </div>
    );
  }

  // User not found - check if we have database profile OR store user
  if (!dbProfile && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">User not found</p>
        <Button onClick={() => navigate("/")} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  const handleConnect = () => {
    if (!resolvedUserId || isOwnProfile) return;
    // Use connection request system instead of direct follow
    sendRequest.mutate(resolvedUserId, {
      onSuccess: () => {
        setAnnounced(true);
        const announcement = document.createElement("div");
        announcement.setAttribute("role", "status");
        announcement.setAttribute("aria-live", "polite");
        announcement.className = "sr-only";
        announcement.textContent = `Connection request sent to ${displayName}.`;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 3000);
        toast.success("Connection request sent!");
      },
      onError: () => {
        toast.error("Failed to send connection request");
      },
    });
  };

  const handleFollowToggle = () => {
    if (!resolvedUserId) return;
    if (userIsFollowing) {
      unfollow(resolvedUserId);
    } else {
      follow(resolvedUserId);
    }
  };

  const handleMessage = () => {
    if (resolvedUserId) {
      navigate(`/messages?user=${resolvedUserId}`);
    }
  };

  const handleBackToPeople = () => {
    const state = location.state as { returnTo?: string } | null;
    if (state?.returnTo === "/people") {
      navigate("/people");
      return;
    }

    safeBack(navigate, "/people");
  };

  const handleBadgeClick = (badge: string) => {
    navigate(`/directory/${badge}`);
  };

  const getConnectButtonLabel = () => {
    if (isOwnProfile) return null;
    if (isConnected || connectionStatus === "accepted") return "Connected";
    if (connectionStatus === "pending" || hasPendingRequest) return "Cancel Request";
    return "Connect";
  };

  const getConnectButtonClass = () => {
    if (isConnected || connectionStatus === "accepted") return "btn-connect btn-connect-connected";
    if (connectionStatus === "pending" || hasPendingRequest) return "btn-connect btn-connect-pending cursor-pointer";
    return "btn-connect";
  };

  const handleCancelRequest = () => {
    if (pendingRequestId) {
      cancelRequest.mutate(pendingRequestId, {
        onSuccess: () => {
          toast.success("Connection request cancelled");
        },
        onError: () => {
          toast.error("Failed to cancel request");
        },
      });
    }
  };

  const getVisibilityIcon = (visibility: Visibility) => {
    switch (visibility) {
      case "public":
        return <Eye className="w-4 h-4" />;
      case "connections":
        return <Users className="w-4 h-4" />;
      case "private":
        return <EyeOff className="w-4 h-4" />;
    }
  };

  const showProfessionalDetails = Boolean(
    (dbProfile?.show_union_status && displayUnionStatus) ||
    (dbProfile?.show_representation && displayRepresentation) ||
    (dbProfile?.show_gear_list && displayGearList && displayGearList.length > 0),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — back button only */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <button
            onClick={handleBackToPeople}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to People"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Centered profile frame */}
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-10">
        {/* Unified profile content frame */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm">
          {/* Two-column header: info bubbles on the LEFT, avatar rectangle on the RIGHT */}
          <section
            id="profile-overview"
            className="scroll-mt-24 border-b border-border bg-card/80 px-4 py-6 text-center sm:px-6 lg:px-8"
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8 items-stretch justify-items-center">
              {/* LEFT column — name, bubbles, skills */}
              <div className="flex w-full min-w-0 flex-col items-center justify-center gap-4 order-2 sm:order-1">
                {/* Name area */}
                <div className="w-full">
                  {/* Editable Name */}
                  {isOwnProfile && isEditingName ? (
                    <div className="flex items-center justify-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-2xl sm:text-3xl font-display font-bold h-auto py-1"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
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
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center justify-center gap-3">
                        {/* Stage Name - shown above real name if present */}
                        {displayStageName && (
                          <h1 className="text-2xl sm:text-3xl font-display font-bold">{displayStageName}</h1>
                        )}
                        {/* Vouch count badge */}
                        {vouchCount > 0 && displayStageName && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Award className="w-4 h-4" />
                            <span className="text-sm font-medium">{vouchCount}</span>
                          </div>
                        )}
                      </div>
                      {/* Real name - shown below stage name or as main name */}
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={cn(
                            displayStageName
                              ? "text-lg text-muted-foreground"
                              : "text-2xl sm:text-3xl font-display font-bold",
                            isOwnProfile && "cursor-pointer hover:text-primary transition-colors group",
                          )}
                          onClick={isOwnProfile ? startEditingName : undefined}
                        >
                          {displayName || "Add your name"}
                          {isOwnProfile && !displayStageName && (
                            <Pencil className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                        {!displayStageName && vouchCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Award className="w-4 h-4" />
                            <span className="text-sm font-medium">{vouchCount}</span>
                          </div>
                        )}
                      </div>
                      {/* Website + Instagram links displayed below name */}
                      {(displayWebsite || displayInstagram) &&
                        (() => {
                          const websiteEl = displayWebsite
                            ? (() => {
                                const href = /^https?:\/\//i.test(displayWebsite)
                                  ? displayWebsite
                                  : `https://${displayWebsite}`;
                                let label = displayWebsite;
                                try {
                                  label =
                                    new URL(href).host.replace(/^www\./, "") +
                                    new URL(href).pathname.replace(/\/$/, "");
                                } catch {}
                                return (
                                  <a
                                    key="web"
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm italic text-blue-500 hover:underline"
                                  >
                                    {label}
                                  </a>
                                );
                              })()
                            : null;
                          const instagramEl = displayInstagram
                            ? (() => {
                                const handle = displayInstagram
                                  .replace(/^@/, "")
                                  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
                                  .replace(/\/$/, "");
                                const igHref = /^https?:\/\//i.test(displayInstagram)
                                  ? displayInstagram
                                  : `https://www.instagram.com/${handle}`;
                                return (
                                  <a
                                    key="ig"
                                    href={igHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm italic text-pink-600 hover:underline"
                                    style={{ color: "#c2185b" }}
                                  >
                                    <Instagram className="w-3.5 h-3.5" style={{ color: "#ec4899" }} />@{handle}
                                  </a>
                                );
                              })()
                            : null;
                          return (
                            <div className="mt-1 flex items-center justify-center gap-3 flex-wrap">
                              {websiteEl}
                              {instagramEl}
                            </div>
                          );
                        })()}
                      {/* Generated headline: "Role1, Role2 based in Location" */}
                      {(() => {
                        const hasRoles = displayRoles.length > 0;
                        const hasLocation = !!displayLocation;
                        if (!hasRoles && !hasLocation && !isOwnProfile) return null;
                        return (
                          <p className="text-muted-foreground text-sm mt-1 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                            {hasRoles ? (
                              displayRoles.map((role, i) => (
                                <span key={`${role}-${i}`}>
                                  <span
                                    className={
                                      isOwnProfile ? "cursor-pointer hover:text-foreground hover:underline" : ""
                                    }
                                    onClick={isOwnProfile ? startEditingRole : undefined}
                                  >
                                    {role}
                                  </span>
                                  {i < displayRoles.length - 1 ? "," : ""}
                                </span>
                              ))
                            ) : isOwnProfile ? (
                              <span
                                className="cursor-pointer italic hover:text-foreground hover:underline"
                                onClick={startEditingRole}
                              >
                                Add roles
                              </span>
                            ) : null}
                            {(hasLocation || isOwnProfile) && (
                              <>
                                <span>{hasRoles ? " based in " : ""}</span>
                                {hasLocation ? (
                                  <span
                                    className={
                                      isOwnProfile ? "cursor-pointer hover:text-foreground hover:underline" : ""
                                    }
                                    onClick={isOwnProfile ? startEditingLocation : undefined}
                                  >
                                    {displayLocation}
                                  </span>
                                ) : isOwnProfile ? (
                                  <span
                                    className="cursor-pointer italic hover:text-foreground hover:underline"
                                    onClick={startEditingLocation}
                                  >
                                    add location
                                  </span>
                                ) : null}
                              </>
                            )}
                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={startEditingRole}
                                className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                aria-label="Edit headline"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Fill-in-the-blank bubble row */}
                <div className="flex flex-wrap items-center justify-center gap-2" data-tour="profile-roles">
                  {/* Role Badges - Multiple roles support (up to 4) */}
                  {isOwnProfile && isEditingRole && (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-48 h-7 text-sm"
                        placeholder="Roles (comma separated)"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRole()}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveRole}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingRole(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Location */}
                  {isOwnProfile && isEditingLocation && (
                    <div className="flex items-center gap-1 min-w-[200px]">
                      <div className="flex-1">
                        <LocationCombobox
                          value={editLocation}
                          onChange={(val) => setEditLocation(val)}
                          placeholder="Select location..."
                        />
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveLocation}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setIsEditingLocation(false)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Affiliation badges */}
                  {displayBadges.map((badge) => (
                    <div key={badge} className="relative group">
                      <button onClick={() => handleBadgeClick(badge)} className="badge-pill">
                        {badge}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-sm font-medium cursor-pointer hover:bg-secondary/80 gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Affiliation
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-popover border border-border z-50">
                        {studioBadgeOptions
                          .filter((option) => !displayBadges?.includes(option.tag.toLowerCase()))
                          .map((option) => (
                            <DropdownMenuItem
                              key={option.tag}
                              onClick={() => handleAddBadgeToDb(option.tag)}
                              className="cursor-pointer"
                            >
                              <span className="text-primary font-medium">{option.tag}</span>
                              <span className="ml-2 text-muted-foreground text-sm">{option.label}</span>
                            </DropdownMenuItem>
                          ))}
                        {studioBadgeOptions.filter((option) => !displayBadges?.includes(option.tag.toLowerCase()))
                          .length === 0 && (
                          <DropdownMenuItem disabled className="text-muted-foreground">
                            All affiliations added
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Bio — moved beneath Skills */}
                <div className="w-full text-center">
                  {isOwnProfile && isEditingBio ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="min-h-[120px] text-base leading-relaxed resize-none"
                        placeholder="Tell your story... What drives you? What are you working on?"
                        autoFocus
                        maxLength={2000}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{editBio.length}/2000</span>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveBio}>
                            <Save className="w-4 h-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditingBio(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`${isOwnProfile ? "cursor-pointer hover:bg-muted/50 p-3 -m-3 rounded-lg transition-colors group" : ""}`}
                      onClick={isOwnProfile ? startEditingBio : undefined}
                    >
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{displayBio || ""}</p>
                      {isOwnProfile && !displayBio && (
                        <p className="text-muted-foreground text-sm italic">Add a bio to let others know who you are</p>
                      )}
                      {isOwnProfile && displayBio && (
                        <Pencil className="w-4 h-4 inline ml-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                      )}
                    </div>
                  )}
                </div>

                {/* Network/share footer */}
                <div className="w-full max-w-md border-t border-border/70 pt-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => navigate(isOwnProfile ? "/network" : `/mutuals/${resolvedUserId}`)}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary hover:underline"
                    >
                      <span className="font-semibold text-foreground">{networkCounts?.networkCount || 0}</span>{" "}
                      connection{networkCounts?.networkCount !== 1 ? "s" : ""}
                    </button>
                    {isOwnProfile && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-border bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Share profile"
                        onClick={async () => {
                          const url = `${window.location.origin}/profile/${resolvedUserId}`;
                          try {
                            if (navigator.share) {
                              await navigator.share({ title: displayName || "Profile", url });
                            } else {
                              await navigator.clipboard.writeText(url);
                              toast.success("Profile link copied to clipboard");
                            }
                          } catch (err) {
                            try {
                              await navigator.clipboard.writeText(url);
                              toast.success("Profile link copied to clipboard");
                            } catch {
                              toast.error("Could not share profile");
                            }
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isOwnProfile && (
                    <div className="mt-3 flex justify-center">
                      <RequestCompanyAccountDialog />
                    </div>
                  )}
                  {isOwnProfile && <ManageGroupButton />}
                </div>
              </div>

              {/* RIGHT column — avatar rectangle + saves/community/etc */}
              <div className="flex flex-col items-center gap-3 w-full sm:w-[300px] order-1 sm:order-2">
                <div className="relative" data-tour="profile-avatar">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-[264px] h-[336px] sm:w-[300px] sm:h-[390px] rounded-2xl object-cover shadow-card border border-border"
                    />
                  ) : (
                    <div className="flex w-[264px] h-[336px] sm:w-[300px] sm:h-[390px] items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-[hsl(222_35%_8%)] via-[hsl(240_45%_14%)] to-[hsl(222_35%_6%)] shadow-card ring-1 ring-primary/25">
                      <img src={inlightLogo} alt="" className="h-20 w-20 rounded-full object-cover opacity-90" />
                    </div>
                  )}
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
                        className="absolute bottom-2 right-2 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                  {/* Graduation badge - bottom-left of avatar */}
                  {isOwnProfile ? (
                    <div className="absolute bottom-2 left-2">
                      <GradYearDialog
                        currentStatus={displayGraduationStatus}
                        currentYear={displayGraduationYear}
                        onSave={handleSaveGradYear}
                        onClear={handleClearGradYear}
                        trigger={
                          <Badge
                            variant="outline"
                            className="text-xs font-medium cursor-pointer bg-background/80 backdrop-blur hover:bg-secondary/80 gap-1"
                          >
                            <GraduationCap className="w-3 h-3" />
                            {displayGraduationStatus && displayGraduationYear
                              ? `${displayGraduationStatus === "student" ? "Student" : "Alumni"} '${displayGraduationYear.toString().slice(-2)}`
                              : "Grad Year"}
                          </Badge>
                        }
                      />
                    </div>
                  ) : displayGraduationStatus && displayGraduationYear ? (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="text-xs font-medium bg-background/80 backdrop-blur gap-1">
                        <GraduationCap className="w-3 h-3" />
                        {displayGraduationStatus === "student" ? "Student" : "Alumni"} '
                        {displayGraduationYear.toString().slice(-2)}
                      </Badge>
                    </div>
                  ) : null}
                </div>

                {/* Action bubbles below avatar */}
                <div className="flex flex-col gap-2 w-full items-stretch">
                  {isOwnProfile && authUser && (
                    <>
                      <button
                        onClick={() => navigate("/saves")}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-primary/15 dark:bg-white/10 hover:bg-primary/25 dark:hover:bg-white/20 text-sm font-medium text-primary dark:text-white/80 border border-primary/20 dark:border-white/20 transition-colors"
                      >
                        <Bookmark className="w-4 h-4" />
                        My Saves
                      </button>
                      <button
                        onClick={() => navigate("/network")}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-primary/15 dark:bg-white/10 hover:bg-primary/25 dark:hover:bg-white/20 text-sm font-medium text-primary dark:text-white/80 border border-primary/20 dark:border-white/20 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        My Community
                      </button>
                    </>
                  )}
                  {!isOwnProfile && authUser && (
                    <>
                      {/* Vouch Button */}
                      <Button
                        variant={hasVouched ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (hasVouched) {
                            unvouch();
                          } else {
                            setVouchDialogOpen(true);
                          }
                        }}
                        disabled={vouchPending}
                        className={hasVouched ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                      >
                        <Award className="w-4 h-4 mr-1" />
                        {hasVouched ? "Vouched" : "Vouch"}
                      </Button>

                      {/* Vouch Dialog */}
                      <VouchDialog
                        open={vouchDialogOpen}
                        onOpenChange={setVouchDialogOpen}
                        onSubmit={(message) => {
                          vouch(message);
                          setVouchDialogOpen(false);
                        }}
                        isPending={vouchPending}
                        targetName={displayName}
                      />

                      {/* Connect/Cancel/Message Button */}
                      <button
                        onClick={
                          connectionStatus === "accepted" || isConnected
                            ? handleMessage
                            : connectionStatus === "pending" || hasPendingRequest
                              ? handleCancelRequest
                              : handleConnect
                        }
                        disabled={sendRequest.isPending || cancelRequest.isPending}
                        className={getConnectButtonClass()}
                        aria-label={getConnectButtonLabel() || undefined}
                      >
                        {getConnectButtonLabel()}
                      </button>
                    </>
                  )}

                  {/* Report/Block Menu - Only for other profiles */}
                  {!isOwnProfile && authUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-full self-center">
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
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="divide-y divide-border">
            {/* Conditional Details Display - shown at the bottom if user opted in */}
            {/* Materials - Collapsible (own profile) */}
            {isOwnProfile && authUser?.id && (
              <Collapsible
                id="profile-materials"
                open={materialsOpen}
                onOpenChange={handleSectionOpenChange("materials", setMaterialsOpen)}
                className="scroll-mt-24"
              >
                <section className="px-4 sm:px-6 lg:px-8 py-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <h2 className="text-lg font-display font-semibold">Materials</h2>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${materialsOpen ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <Tabs defaultValue="photos" className="w-full">
                      <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
                        <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 max-w-xl">
                          <TabsTrigger value="photos" className="flex-shrink-0 whitespace-nowrap">
                            Photos {uploadedPhotos.length > 0 && `(${uploadedPhotos.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="reels" className="flex-shrink-0 whitespace-nowrap">
                            Reels {uploadedVideos.length > 0 && `(${uploadedVideos.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="resume" className="flex-shrink-0 whitespace-nowrap">
                            Résumé {uploadedDocuments.length > 0 && `(${uploadedDocuments.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="audio" className="flex-shrink-0 whitespace-nowrap">
                            Audio {uploadedAudio.length > 0 && `(${uploadedAudio.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="why-i-started" className="flex-shrink-0 whitespace-nowrap">
                            Why I Started
                          </TabsTrigger>
                        </TabsList>
                      </div>

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

                      <TabsContent value="why-i-started" className="mt-6">
                        <WhyIStarted userId={authUser.id} isOwnProfile={true} />
                      </TabsContent>
                    </Tabs>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            )}

            {/* Public Media Gallery (for other users' profiles) */}
            {!isOwnProfile && resolvedUserId && (
              <ProfileSectionErrorBoundary title="Media">
                <PublicMediaGallery userId={resolvedUserId} isConnected={connectionStatus === "accepted"} />
              </ProfileSectionErrorBoundary>
            )}

            {/* Why I Started (for other users' profiles) */}
            {!isOwnProfile && resolvedUserId && sectionContent?.whyStarted && (
              <section id="profile-story" className="scroll-mt-24 px-4 py-6 sm:px-6 lg:px-8">
                <ProfileSectionErrorBoundary title="Why I Started">
                  <WhyIStarted userId={resolvedUserId} isOwnProfile={false} />
                </ProfileSectionErrorBoundary>
              </section>
            )}

            {/* Credits - Collapsible */}
            <Collapsible
              id="profile-credits"
              open={creditsOpen}
              onOpenChange={handleSectionOpenChange("credits", setCreditsOpen)}
              className="scroll-mt-24"
            >
              <section className="px-4 sm:px-6 lg:px-8 py-4" data-tour="profile-credits">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-display font-semibold">Credits</h2>
                    {displayCredits.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {displayCredits.length}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwnProfile && creditsOpen && (
                      <>
                        <VerifyCreditsDialog credits={displayCredits} />
                        <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Plus className="w-4 h-4 mr-2" />
                              Add
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
                      </>
                    )}
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${creditsOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <ProfileSectionErrorBoundary title="Credits">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Year</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Verified</th>
                            {isOwnProfile && (
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {displayCredits.map((credit) => (
                            <CreditRow
                              key={credit.id}
                              credit={credit}
                              isOwnProfile={isOwnProfile}
                              onDelete={handleDeleteCredit}
                            />
                          ))}
                          {displayCredits.length === 0 && (
                            <tr>
                              <td colSpan={isOwnProfile ? 6 : 5} className="py-8 text-center text-muted-foreground">
                                {isOwnProfile ? "No credits yet. Add your first credit!" : "No credits listed."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </ProfileSectionErrorBoundary>
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* Attended - Collapsible */}
            {resolvedUserId && (
              <Collapsible
                id="profile-attended"
                open={attendedOpen}
                onOpenChange={handleSectionOpenChange("attended", setAttendedOpen)}
                className="scroll-mt-24"
              >
                <section className="px-4 sm:px-6 lg:px-8 py-4">
                  <div className="flex items-center justify-between w-full gap-2">
                    <CollapsibleTrigger className="flex items-center gap-2 group flex-1 min-w-0 text-left">
                      <h2 className="text-lg font-display font-semibold">Attended</h2>
                      <ChevronDown
                        className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${attendedOpen ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>
                    {isOwnProfile && attendedOpen && <AddAttendedDialog />}
                  </div>
                  <CollapsibleContent className="mt-4">
                    <ProfileSectionErrorBoundary title="Attended">
                      <AttendedSection userId={resolvedUserId} isOwnProfile={isOwnProfile} />
                    </ProfileSectionErrorBoundary>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            )}

            {/* Projects - Collapsible */}
            <Collapsible
              id="profile-projects"
              open={projectsOpen}
              onOpenChange={handleSectionOpenChange("projects", setProjectsOpen)}
              className="scroll-mt-24"
            >
              <section className="px-4 sm:px-6 lg:px-8 py-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <h2 className="text-lg font-display font-semibold">Projects</h2>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${projectsOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {resolvedUserId && (
                    <ProfileSectionErrorBoundary title="Projects">
                      <MyProjects userId={resolvedUserId} isOwnProfile={isOwnProfile} />
                    </ProfileSectionErrorBoundary>
                  )}
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* User Posts Section - Collapsible */}
            <Collapsible
              id="profile-posts"
              open={postsOpen}
              onOpenChange={handleSectionOpenChange("posts", setPostsOpen)}
              className="scroll-mt-24"
            >
              <section className="px-4 sm:px-6 lg:px-8 py-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <h2 className="text-lg font-display font-semibold">Posts</h2>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${postsOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {resolvedUserId && (
                    <ProfileSectionErrorBoundary title="Posts">
                      <UserPosts userId={resolvedUserId} />
                    </ProfileSectionErrorBoundary>
                  )}
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* Skills Section - moved below Posts */}
            <section id="profile-skills" className="scroll-mt-24 px-4 sm:px-6 lg:px-8 py-4">
              <h2 className="text-lg font-display font-semibold mb-3">
                Skills{displaySkills.length > 0 && ` (${displaySkills.length})`}
              </h2>
              <div className="p-3 rounded-xl border border-border bg-card/40">
                <div className="flex flex-wrap items-center gap-2">
                  {displaySkills.map((skill) => (
                    <div key={skill} className="relative group">
                      <Badge variant="secondary" className="px-3 py-1">
                        {skill}
                        {isOwnProfile && (
                          <button
                            onClick={() => handleRemoveSkill(skill)}
                            className="ml-1.5 hover:text-destructive transition-colors"
                            aria-label={`Remove ${skill} skill`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    </div>
                  ))}
                  {isOwnProfile && (
                    <SkillsCombobox
                      existingSkills={displaySkills}
                      onAddSkill={async (skill) => {
                        const currentSkills = displaySkills || [];
                        if (currentSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
                          toast.error("Skill already exists");
                          return;
                        }
                        await saveProfileField("skills", [...currentSkills, skill]);
                      }}
                    />
                  )}
                  {displaySkills.length === 0 && !isOwnProfile && (
                    <span className="text-muted-foreground text-sm">No skills added</span>
                  )}
                </div>
              </div>
            </section>

            {/* Conditional Professional Details - shown at bottom if user opted in */}
            {showProfessionalDetails && (
              <section id="profile-details" className="scroll-mt-24 px-4 py-4 sm:px-6 lg:px-8">
                <h2 className="text-lg font-display font-semibold mb-4">Professional Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dbProfile?.show_union_status && displayUnionStatus && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Union Status</h3>
                      <p className="text-foreground">{displayUnionStatus}</p>
                    </div>
                  )}

                  {dbProfile?.show_representation && displayRepresentation && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Representation</h3>
                      <p className="text-foreground">{displayRepresentation}</p>
                    </div>
                  )}

                  {dbProfile?.show_gear_list && displayGearList && displayGearList.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Personal Gear</h3>
                      <div className="flex flex-wrap gap-2">
                        {displayGearList.map((gear, i) => (
                          <Badge key={i} variant="secondary">
                            {gear}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
          {/* /Section stack */}
        </div>
        {/* /Unified profile content frame */}

        {/* Profile Completion Bar - moved to bottom, only visible to profile owner */}
        {isOwnProfile && dbProfile && (
          <div className="mt-4">
            <ProfileCompletionBar
              userId={authUser!.id}
              profile={{
                role: dbProfile.role,
                graduation_year: dbProfile.graduation_year,
                location: dbProfile.location,
                instagram_url: dbProfile.instagram_url,
                website_url: dbProfile.website_url,
                badges: dbProfile.badges,
                skills: dbProfile.skills,
                bio: dbProfile.bio,
              }}
              creditsCount={dbCredits.length}
            />
          </div>
        )}
      </div>
      {/* /Centered profile frame */}

      {/* Lightbox */}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Lightbox view" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Post Creator Dialog */}
      <Dialog open={showPostCreator} onOpenChange={setShowPostCreator}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {defaultPostType === "update"
                ? "Post an Update"
                : defaultPostType === "event"
                  ? "Create an Event"
                  : "Post an Opportunity"}
            </DialogTitle>
          </DialogHeader>
          <PostCreator
            userProfile={
              dbProfile ? { display_name: dbProfile.display_name, avatar_url: dbProfile.avatar_url } : undefined
            }
            defaultOpen={true}
            defaultPostType={defaultPostType}
            onClose={() => setShowPostCreator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Project Creator Dialog */}
      {isOwnProfile && authUser && (
        <ProjectCreator
          open={showProjectCreator}
          onOpenChange={setShowProjectCreator}
          onSuccess={() => setShowProjectCreator(false)}
        />
      )}
      {/* Floating chat icon for connected users - or minimized bubble */}
      {!isOwnProfile &&
        isConnected &&
        resolvedUserId &&
        (chatMinimized && chatOriginRoute === location.pathname && chatRoute ? (
          <FloatingChatButton
            onClick={() => {
              expandChat();
              navigate(chatRoute, { state: { originRoute: location.pathname } });
            }}
          />
        ) : !chatMinimized ? (
          <FloatingChatButton
            onClick={() =>
              navigate(`/messages/direct/${resolvedUserId}`, { state: { originRoute: location.pathname } })
            }
          />
        ) : null)}
    </div>
  );
};

const ProfilePageWithBoundary: React.FC = () => (
  <ProfilePageErrorBoundary>
    <ProfilePage />
  </ProfilePageErrorBoundary>
);

export default ProfilePageWithBoundary;
