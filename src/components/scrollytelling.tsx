import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform, MotionValue, useSpring } from "framer-motion";
import { Sparkle } from "./Sparkle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/inlight-logo.jpeg";
import audience1 from "@/assets/audience-1.jpg";
import audience2 from "@/assets/audience-2.jpg";
import community from "@/assets/community.jpg";
import winner from "@/assets/winner.jpg";
import panel from "@/assets/panel.jpg";
import collage from "@/assets/collage.jpg";
import dance from "@/assets/dance.jpg";

const authPrimaryButtonClass =
  "!h-12 !rounded-xl !bg-none !bg-foreground !text-background font-medium tracking-wide hover:!bg-none hover:!bg-foreground/90";

type LandingProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string | null;
  headline: string | null;
  bio: string | null;
  graduation_year: number | null;
  badges: string[];
  skills: string[];
};

type LandingEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  event_type: string | null;
  image_url: string | null;
};

type LandingProject = {
  id: string;
  title: string;
  category: string | null;
  status: string | null;
  image_url: string | null;
  creatorName: string | null;
};

type LandingPost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  creatorName: string | null;
  creatorRole: string | null;
  creatorAvatar: string | null;
  creatorGradYear: number | null;
  isProfileFallback?: boolean;
};

type LandingPreviewData = {
  profiles: LandingProfile[];
  events: LandingEvent[];
  projects: LandingProject[];
  posts: LandingPost[];
};

const fallbackImages = [audience1, winner, community, panel, collage, audience2, dance];

const getFallbackImage = (index: number) => fallbackImages[index % fallbackImages.length];

const cleanPreviewText = (value: string | null | undefined, maxLength = 160) => {
  const text = value?.replace(/\s+/g, " ").replace(/[,\s]+$/g, "").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
};

const formatLabel = (value: string | null | undefined) =>
  cleanPreviewText(value, 36)
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || null;

const isPlatformProfileName = (name: string | null | undefined) =>
  (name || "").trim().toLowerCase() === "inlight";

const formatClassYear = (year: number | null | undefined) =>
  year ? `Class of '${String(year).slice(-2)}` : null;

const toDisplayName = (name?: string | null) => name?.trim() || null;

const formatEventDay = (value: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(value)).toUpperCase();

const formatEventDate = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(value));

const formatEventMonth = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(value));

const formatEventWeek = (value: string) => {
  const date = new Date(value);
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return `Week ${Math.ceil((days + start.getDay() + 1) / 7)}`;
};

const formatEventLocation = (event: LandingEvent) => {
  const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(event.event_date));
  return [event.location, time].filter(Boolean).join(" · ");
};

const formatRelativeTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(elapsed / 3_600_000));
  if (hours < 1) return "Now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  const weeks = Math.max(1, Math.round(days / 7));
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
};

async function loadLandingPreviewData(): Promise<LandingPreviewData> {
  const today = new Date().toISOString();

  const [profilesResult, upcomingEventsResult, pastEventsResult, projectsResult, postsResult] = await Promise.all([
    supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url, role, headline, bio, graduation_year, badges, skills")
      .not("display_name", "is", null)
      .order("activity_score", { ascending: false, nullsFirst: false })
      .limit(24),
    supabase
      .from("events")
      .select("id, title, event_date, location, event_type, image_url")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(8),
    supabase
      .from("events")
      .select("id, title, event_date, location, event_type, image_url")
      .lt("event_date", today)
      .order("event_date", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("id, title, category, status, header_image_url, main_image_url, creator_id")
      .eq("is_public", true)
      .or("status.is.null,status.neq.archived")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("posts")
      .select("id, content, created_at, user_id")
      .eq("visibility", "public")
      .not("content", "like", "🎯%")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const errors = [profilesResult.error, upcomingEventsResult.error, pastEventsResult.error, projectsResult.error, postsResult.error].filter(Boolean);
  if (errors.length) console.warn("Landing preview public data loaded with query errors", errors);

  const profiles = (profilesResult.data || [])
    .filter((profile) => profile.user_id && toDisplayName(profile.display_name))
    .map((profile) => ({
      user_id: profile.user_id!,
      display_name: toDisplayName(profile.display_name)!,
      avatar_url: profile.avatar_url,
      role: profile.role,
      headline: profile.headline,
      bio: profile.bio,
      graduation_year: profile.graduation_year,
      badges: profile.badges || [],
      skills: profile.skills || [],
    }));

  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const upcomingEvents = upcomingEventsResult.data || [];
  const pastEvents = pastEventsResult.data || [];
  const eventRows = upcomingEvents.length >= 5
    ? upcomingEvents.slice(0, 5)
    : [
        ...pastEvents.slice(0, 5 - upcomingEvents.length).reverse(),
        ...upcomingEvents,
      ];

  const postRows = postsResult.data || [];
  const uniquePosts = postRows.filter((post, index, allPosts) =>
    allPosts.findIndex((candidate) => candidate.user_id === post.user_id) === index,
  );
  const uniquePostUserIds = Array.from(new Set(uniquePosts.map((post) => post.user_id).filter(Boolean)));

  if (uniquePostUserIds.length) {
    const { data: postProfiles, error: postProfilesError } = await supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url, role, headline, graduation_year")
      .in("user_id", uniquePostUserIds);

    if (postProfilesError) {
      console.warn("Landing preview post author profiles loaded with query errors", postProfilesError);
    }

    (postProfiles || []).forEach((profile) => {
      if (!profile.user_id || !toDisplayName(profile.display_name)) return;
      profileMap.set(profile.user_id, {
        user_id: profile.user_id,
        display_name: toDisplayName(profile.display_name)!,
        avatar_url: profile.avatar_url,
        role: profile.role,
        headline: profile.headline,
        bio: null,
        graduation_year: profile.graduation_year,
        badges: [],
        skills: [],
      });
    });
  }

  const selectedPosts: Array<{
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    isProfileFallback?: boolean;
  }> = uniquePosts
    .filter((post) => {
      const creator = profileMap.get(post.user_id);
      return creator?.display_name && !isPlatformProfileName(creator.display_name);
    })
    .slice(0, 4);

  if (selectedPosts.length < 4) {
    const selectedUserIds = new Set(selectedPosts.map((post) => post.user_id));
    const profileFallbacks = profiles
      .map((profile) => ({
        profile,
        description: cleanPreviewText(profile.bio || profile.headline, 120),
      }))
      .filter(({ profile, description }) => (
        profile.display_name &&
        description &&
        !isPlatformProfileName(profile.display_name) &&
        !selectedUserIds.has(profile.user_id)
      ))
      .slice(0, 4 - selectedPosts.length)
      .map(({ profile, description }) => ({
        id: `profile-${profile.user_id}`,
        user_id: profile.user_id,
        content: description!,
        created_at: new Date().toISOString(),
        isProfileFallback: true,
      }));

    selectedPosts.push(...profileFallbacks);
  }

  if (selectedPosts.length < 4) {
    const selectedPostIds = new Set(selectedPosts.map((post) => post.id));
    const repeatedAuthorPosts = postRows.filter((post) => !selectedPostIds.has(post.id));
    selectedPosts.push(...repeatedAuthorPosts.slice(0, 4 - selectedPosts.length));
  }

  return {
    profiles,
    events: eventRows.map((event) => ({
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      location: event.location,
      event_type: event.event_type,
      image_url: event.image_url,
    })),
    projects: (projectsResult.data || []).map((project) => ({
      id: project.id,
      title: project.title,
      category: project.category,
      status: project.status,
      image_url: project.header_image_url || project.main_image_url,
      creatorName: profileMap.get(project.creator_id)?.display_name || null,
    })),
    posts: selectedPosts.map((post) => {
      const creator = profileMap.get(post.user_id);
      return {
        id: post.id,
        user_id: post.user_id,
        content: cleanPreviewText(post.content, 120) || post.content,
        created_at: post.created_at,
        creatorName: creator?.display_name || null,
        creatorRole: creator?.role || creator?.headline || null,
        creatorAvatar: creator?.avatar_url || null,
        creatorGradYear: creator?.graduation_year || null,
        isProfileFallback: post.isProfileFallback,
      };
    }),
  };
}

function useLandingPreviewData() {
  return useQuery({
    queryKey: ["landing-public-preview-data"],
    queryFn: loadLandingPreviewData,
    staleTime: 5 * 60 * 1000,
  });
}

/* ---------- HERO ---------- */
export function Hero({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.7, 1], [1, 1, 0]);
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  const y = useTransform(progress, [0, 1], [0, -100]);
  const sparkleY = useTransform(progress, [0, 1], [0, -200]);

  return (
    <motion.section
      style={{ opacity }}
      className="relative h-screen w-full flex items-center justify-center px-6"
    >
      <motion.div
        style={{ scale, y }}
        className="relative z-10 max-w-6xl text-center"
      >
        <motion.div
          style={{ y: sparkleY }}
          className="flex justify-center gap-3 mb-8 text-glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <Sparkle size={18} className="opacity-60" />
          <Sparkle size={28} />
          <Sparkle size={14} className="opacity-40" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-xs sm:text-sm uppercase tracking-[0.4em] text-muted-foreground mb-8"
        >
          Bridging the visibility gap in the creative economy
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="font-editorial text-white text-[14vw] sm:text-[10vw] md:text-[8.5vw] leading-[0.95] tracking-tight"
        >
          The <em className="italic text-accent-blue font-normal">interactive</em>
          <br />
          network for entertainment
          <br />
          <span className="text-white/70">students &amp; alumni.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="mt-10 text-sm text-muted-foreground tracking-widest uppercase"
        >
          Scroll to begin ↓
        </motion.p>
      </motion.div>
    </motion.section>
  );
}

/* ---------- SECTION SCAFFOLD ---------- */
function StopHeader({
  number,
  title,
  caption,
  progress,
  range,
}: {
  number: string;
  title: React.ReactNode;
  caption: string;
  progress: MotionValue<number>;
  range: [number, number, number, number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, range, [60, 0, 0, -60]);
  return (
    <motion.div style={{ opacity, y }} className="text-center max-w-4xl mx-auto px-6">
      <div className="flex items-center justify-center gap-3 mb-6 text-xs tracking-[0.4em] uppercase text-muted-foreground">
        <span className="h-px w-8 bg-border" />
        {number}
        <span className="h-px w-8 bg-border" />
      </div>
      <h2 className="font-editorial text-white text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight">
        {title}
      </h2>
      <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">{caption}</p>
    </motion.div>
  );
}

/* ---------- STOP 1 — EVENTS ---------- */
export function EventsStop({ progress }: { progress: MotionValue<number> }) {
  const cardY = useTransform(progress, [0, 0.5, 1], [200, 0, -100]);
  const cardScale = useTransform(progress, [0, 0.5, 1], [0.85, 1, 1.05]);
  const cardOpacity = useTransform(progress, [0, 0.3, 0.8, 1], [0, 1, 1, 0]);
  const { data, isLoading } = useLandingPreviewData();

  const events = data?.events.length
    ? data.events.slice(0, 5).map((event, index) => ({
        id: event.id,
        day: formatEventDay(event.event_date),
        date: formatEventDate(event.event_date),
        title: event.title,
        tag: event.event_type || "Event",
        loc: formatEventLocation(event),
        img: event.image_url || getFallbackImage(index),
        month: formatEventMonth(event.event_date),
        week: formatEventWeek(event.event_date),
        isPlaceholder: false,
      }))
    : isLoading
    ? Array.from({ length: 5 }, (_, index) => ({
        id: `loading-event-${index}`,
        day: "",
        date: "",
        title: "",
        tag: "",
        loc: "",
        img: getFallbackImage(index),
        month: "Loading public events",
        week: "",
        isPlaceholder: true,
      }))
    : [
        { day: "SUN", date: "08", title: "Dance for Camera", tag: "Workshop", loc: "Gibney Dance, Studio U · 7–9pm", img: dance, month: "June 2026", week: "Week 23", isPlaceholder: false },
        { day: "FRI", date: "12", title: "Tisch Senior Film Showcase", tag: "Screening", loc: "Cantor Film Center", img: audience1, month: "June 2026", week: "Week 23", isPlaceholder: false },
        { day: "SAT", date: "13", title: "Self-Tape Night with Casting Society", tag: "Workshop", loc: "USC SCA · 7pm", img: winner, month: "June 2026", week: "Week 23", isPlaceholder: false },
        { day: "SUN", date: "14", title: "Juilliard Composers' Concert", tag: "Performance", loc: "Alice Tully Hall", img: community, month: "June 2026", week: "Week 23", isPlaceholder: false },
        { day: "MON", date: "15", title: "Industry Talkback: A24 Producers", tag: "Panel", loc: "Virtual · 6pm", img: panel, month: "June 2026", week: "Week 23", isPlaceholder: false },
      ];
  const eventGroups = events.reduce<Array<{ month: string; week: string; rows: typeof events }>>((groups, event) => {
    const current = groups[groups.length - 1];
    if (!current || current.month !== event.month) {
      groups.push({ month: event.month, week: event.week, rows: [event] });
    } else {
      current.rows.push(event);
    }
    return groups;
  }, []);

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 01 — Events"
        title={
          <>
            Find events that <em className="italic text-accent-blue font-normal">move</em> you.
          </>
        }
        caption="From senior thesis screenings to industry talkbacks — every showcase, workshop, and self-tape night, in one calendar."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ y: cardY, scale: cardScale, opacity: cardOpacity }}
        className="mt-6 w-full max-w-4xl px-6"
      >
        <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-xl shadow-soft overflow-hidden">
          {eventGroups.map((group, groupIndex) => (
            <div key={group.month} className={groupIndex > 0 ? "border-t border-border" : undefined}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-glow" />
                  <span className="font-display italic text-lg">{group.month}</span>
                </div>
                <div className="text-xs tracking-widest uppercase text-muted-foreground">{group.week}</div>
              </div>
              <div className="divide-y divide-border">
                {group.rows.map((e, rowIndex) => (
                  <motion.div
                    key={e.id || `${group.month}-${rowIndex}`}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (groupIndex + rowIndex) * 0.05 }}
                    className="grid grid-cols-[60px_1fr_auto] sm:grid-cols-[80px_60px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-secondary/40 transition-colors"
                  >
                    {e.isPlaceholder ? (
                      <>
                        <div className="space-y-2">
                          <div className="mx-auto h-3 w-8 rounded-full bg-muted/30 animate-pulse" />
                          <div className="mx-auto h-7 w-9 rounded-md bg-muted/30 animate-pulse" />
                        </div>
                        <div className="hidden sm:block h-11 w-11 rounded-lg bg-muted/30 animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 w-3/5 rounded-full bg-muted/30 animate-pulse" />
                          <div className="h-3 w-2/5 rounded-full bg-muted/20 animate-pulse" />
                        </div>
                        <div className="hidden sm:block h-7 w-24 rounded-full border border-border bg-muted/20 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="text-xs tracking-widest text-muted-foreground">{e.day}</div>
                          <div className="font-display text-2xl">{e.date}</div>
                        </div>
                        <div className="hidden sm:block h-11 w-11 rounded-lg overflow-hidden">
                          <img src={e.img} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{e.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{e.loc}</div>
                        </div>
                        <span className="hidden sm:inline-block text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                          {e.tag}
                        </span>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- STOP 2 — PROJECTS ---------- */
export function ProjectsStop({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const rotateX = useTransform(progress, [0, 0.5, 1], [20, 0, -10]);
  const y = useTransform(progress, [0, 0.5, 1], [120, 0, -80]);
  const { data, isLoading } = useLandingPreviewData();

  const projects = data?.projects.length
    ? data.projects.slice(0, 4).map((project, index) => ({
        title: cleanPreviewText(project.title, 54) || project.title,
        maker: [formatLabel(project.category), project.creatorName].filter(Boolean).join(" · ") || "Public Inlight project",
        tags: [formatLabel(project.category), formatLabel(project.status)].filter(Boolean).slice(0, 2) as string[],
        img: project.image_url || getFallbackImage(index + 1),
        isPlaceholder: false,
      }))
    : isLoading
    ? Array.from({ length: 4 }, (_, index) => ({
        title: "",
        maker: "",
        tags: [] as string[],
        img: getFallbackImage(index + 1),
        isPlaceholder: true,
      }))
    : [
        { title: "Untitled Short — DP wanted", maker: "NYU Tisch · MFA", tags: ["Director of Photography", "Verified"], img: audience2, isPlaceholder: false },
        { title: "Original Musical · seeking lyricist", maker: "USC Thornton", tags: ["Songwriter"], img: collage, isPlaceholder: false },
        { title: "Devised theatre — 4 performers", maker: "Juilliard Drama", tags: ["Actor", "Movement"], img: panel, isPlaceholder: false },
        { title: "EP rollout · need cover art", maker: "Berklee Alum", tags: ["Designer", "Verified"], img: winner, isPlaceholder: false },
      ];

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 02 — Projects"
        title={
          <>
            Find collaborative <em className="italic text-accent-blue font-normal">projects</em>
            <br />— or launch your own.
          </>
        }
        caption="Crew calls, casting boards, songwriting rooms. Reputation-verified tags, gathered by craft."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ opacity, y, rotateX, perspective: 1200 }}
        className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl px-6"
      >
        {projects.map((p, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -8 }}
            className="group rounded-2xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden shadow-soft"
          >
            {p.isPlaceholder ? (
              <>
                <div className="aspect-square bg-muted/30 animate-pulse" />
                <div className="p-3 space-y-3">
                  <div className="h-3 w-3/5 rounded-full bg-muted/30 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-4/5 rounded-full bg-muted/30 animate-pulse" />
                    <div className="h-4 w-2/3 rounded-full bg-muted/20 animate-pulse" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 rounded-full border border-border bg-muted/20 animate-pulse" />
                    <div className="h-5 w-12 rounded-full border border-border bg-muted/20 animate-pulse" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="aspect-square overflow-hidden">
                  <img
                    src={p.img}
                    alt=""
                    className="h-full w-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:grayscale-0 transition duration-700"
                  />
                </div>
                <div className="p-3">
                  <div className="text-[10px] tracking-widest uppercase text-muted-foreground">
                    {p.maker}
                  </div>
                  <div className="font-display text-base leading-tight mt-1">{p.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                      >
                        {t === "Verified" ? "✦ " : ""}
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------- STOP 3 — NETWORK ---------- */
export function NetworkStop({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0, 0.5, 1], [0.7, 1, 1.1]);
  const fieldNames = [
    "Photography",
    "Film",
    "Music",
    "Art",
    "Production design",
    "Creative writing",
    "Performance",
  ];

  const fields = fieldNames.map((name, index) => {
    const points = [
      { x: 20, y: 30 },
      { x: 75, y: 25 },
      { x: 50, y: 15 },
      { x: 85, y: 65 },
      { x: 15, y: 70 },
      { x: 60, y: 80 },
      { x: 40, y: 55 },
    ];
    return { name, ...points[index % points.length] };
  });

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 03 — Network"
        title={
          <>
            Real-world connections,
            <br />
            across every <em className="italic text-accent-blue font-normal">creative field</em>.
          </>
        }
        caption="Actors, composers, writers, designers, producers, and crew connected by the work they are already making."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ opacity, scale }}
        className="mt-6 relative w-full max-w-3xl aspect-[16/9] mx-auto px-6"
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 62" preserveAspectRatio="none">
          {fields.map((a, i) =>
            fields.slice(i + 1).map((b, j) => (
              <motion.line
                key={`${i}-${j}`}
                x1={a.x}
                y1={a.y * 0.62}
                x2={b.x}
                y2={b.y * 0.62}
                stroke="oklch(0.72 0.18 265)"
                strokeWidth="0.1"
                strokeOpacity="0.3"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2, delay: (i + j) * 0.05 }}
              />
            )),
          )}
        </svg>
        {fields.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-glow blur-xl opacity-40 animate-twinkle" />
              <div className="relative h-3 w-3 rounded-full bg-glow shadow-glow" />
              <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs tracking-wider text-muted-foreground">
                {s.name}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------- STOP 4 — TRACK ---------- */
export function TrackStop({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const x = useTransform(progress, [0, 0.5, 1], [200, 0, -150]);
  const { data, isLoading } = useLandingPreviewData();

  const people = data?.posts.length
    ? data.posts.slice(0, 4).map((post, index) => ({
        name: post.creatorName || "Inlight member",
        role: [cleanPreviewText(post.creatorRole, 36), formatClassYear(post.creatorGradYear)].filter(Boolean).join(" / ") || "Creative",
        credit: post.content,
        img: post.creatorAvatar || getFallbackImage(index),
        when: post.isProfileFallback ? "Profile highlight" : "Latest",
        isPlaceholder: false,
      }))
    : isLoading
    ? Array.from({ length: 4 }, (_, index) => ({
        name: "",
        role: "",
        credit: "",
        img: getFallbackImage(index),
        when: "",
        isPlaceholder: true,
      }))
    : [
        { name: "Maya Chen", role: "Director / NYU '23", credit: "Now in post on 'Soft Static' (short)", img: audience1, when: "Profile highlight", isPlaceholder: false },
        { name: "Daniel Park", role: "Composer / USC '24", credit: "Released single 'Inland Sea' — Spotify", img: winner, when: "Profile highlight", isPlaceholder: false },
        { name: "Sofia Rivera", role: "Actor / Juilliard '22", credit: "Booked recurring on Hulu pilot", img: community, when: "Profile highlight", isPlaceholder: false },
        { name: "Jules Okafor", role: "Producer / Tisch '21", credit: "Sundance Episodic Lab '26", img: panel, when: "Profile highlight", isPlaceholder: false },
      ];

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 04 — Track"
        title={
          <>
            Stay up-to-date on what your classmates,
            <br /> colleagues, and collaborators are <em className="italic text-accent-blue font-normal">working on</em>.
          </>
        }
        caption="Rolling, real-time credits. New roles, singles, productions — surfaced from your circle the moment they happen."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ opacity, x }}
        className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl px-6 w-full"
      >
        {people.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 shadow-soft"
          >
            {p.isPlaceholder ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted/30 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded-full bg-muted/30 animate-pulse" />
                    <div className="h-3 w-3/5 rounded-full bg-muted/20 animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="h-3 w-16 rounded-full bg-muted/30 animate-pulse" />
                  <div className="h-4 w-full rounded-full bg-muted/20 animate-pulse" />
                  <div className="h-4 w-4/5 rounded-full bg-muted/20 animate-pulse" />
                  <div className="h-4 w-3/5 rounded-full bg-muted/20 animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <img src={p.img} alt={p.name} className="h-12 w-12 rounded-full object-cover grayscale" />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground">
                      {p.role}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  {p.when ? (
                    <div className="text-[10px] tracking-widest uppercase text-glow mb-1.5">
                      ✦ {p.when}
                    </div>
                  ) : null}
                  <p className="text-sm text-muted-foreground leading-snug">{p.credit}</p>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------- FINAL CTA ---------- */
export function CTAStop() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [0.7, 1]), { stiffness: 80, damping: 20 });
  const opacity = useTransform(scrollYProgress, [0, 0.4, 1], [0, 1, 1]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center px-6 py-24">
      <motion.div style={{ scale, opacity }} className="relative max-w-2xl w-full text-center">
        <div className="flex justify-center gap-2 mb-8 text-glow">
          <Sparkle size={20} className="opacity-60" />
          <Sparkle size={32} />
          <Sparkle size={16} className="opacity-40" />
        </div>
        <h2 className="font-editorial text-white text-6xl sm:text-8xl leading-[1.05] tracking-tight">
          Step into <em className="italic text-accent-blue font-normal">the light</em>.
        </h2>
        <p className="mt-6 text-muted-foreground max-w-md mx-auto">
          Claim your place in the network built by — and for — the next generation of entertainment.
        </p>

        <div className="mt-12 rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-soft">
          <div className="space-y-4">
            <Button
              type="button"
              className={cn("w-full", authPrimaryButtonClass)}
              onClick={() => navigate("/auth")}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="!h-12 !rounded-xl !border-border !bg-none !bg-secondary/30 !text-muted-foreground hover:!bg-none hover:!bg-secondary/50 hover:!text-white w-full"
              onClick={() => navigate("/auth?mode=signup")}
            >
              Create account
            </Button>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            By continuing you agree to Inlight's Terms & Privacy.
          </p>
        </div>

        <div className="mt-16 flex items-center justify-center gap-3 opacity-60">
          <img src={logo} alt="Inlight" className="h-6 w-auto invert" />
        </div>
        <p className="mt-3 text-[11px] tracking-widest uppercase text-muted-foreground">
          © Inlight — made by artists, for artists
        </p>
      </motion.div>
    </section>
  );
}
