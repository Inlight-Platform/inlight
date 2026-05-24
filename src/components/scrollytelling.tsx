import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, MotionValue, useSpring } from "framer-motion";
import { Sparkle } from "./Sparkle";
import logo from "@/assets/inlight-logo.jpeg";
import audience1 from "@/assets/audience-1.jpg";
import audience2 from "@/assets/audience-2.jpg";
import community from "@/assets/community.jpg";
import winner from "@/assets/winner.jpg";
import panel from "@/assets/panel.jpg";
import collage from "@/assets/collage.jpg";

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

  const events = [
    { day: "FRI", date: "12", title: "Tisch Senior Film Showcase", tag: "Screening", loc: "Cantor Film Center", img: audience1 },
    { day: "SAT", date: "13", title: "Self-Tape Night with Casting Society", tag: "Workshop", loc: "USC SCA · 7pm", img: winner },
    { day: "SUN", date: "14", title: "Juilliard Composers' Concert", tag: "Performance", loc: "Alice Tully Hall", img: community },
    { day: "MON", date: "15", title: "Industry Talkback: A24 Producers", tag: "Panel", loc: "Virtual · 6pm", img: panel },
  ];

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
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-glow" />
              <span className="font-display italic text-lg">November</span>
            </div>
            <div className="text-xs tracking-widest uppercase text-muted-foreground">Week 46</div>
          </div>
          <div className="divide-y divide-border">
            {events.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-[60px_1fr_auto] sm:grid-cols-[80px_60px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-secondary/40 transition-colors"
              >
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
              </motion.div>
            ))}
          </div>
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

  const projects = [
    { title: "Untitled Short — DP wanted", maker: "NYU Tisch · MFA", tags: ["Director of Photography", "Verified"], img: audience2 },
    { title: "Original Musical · seeking lyricist", maker: "USC Thornton", tags: ["Songwriter"], img: collage },
    { title: "Devised theatre — 4 performers", maker: "Juilliard Drama", tags: ["Actor", "Movement"], img: panel },
    { title: "EP rollout · need cover art", maker: "Berklee Alum", tags: ["Designer", "Verified"], img: winner },
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

  const schools = [
    { name: "NYU Tisch", x: 20, y: 30 },
    { name: "USC SCA", x: 75, y: 25 },
    { name: "Juilliard", x: 50, y: 15 },
    { name: "Berklee", x: 85, y: 65 },
    { name: "Yale Drama", x: 15, y: 70 },
    { name: "AFI", x: 60, y: 80 },
    { name: "CalArts", x: 40, y: 55 },
  ];

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 03 — Network"
        title={
          <>
            Real-world connections,
            <br />
            inside your <em className="italic text-accent-blue font-normal">university</em>.
          </>
        }
        caption="Direct bridges from current students to alumni already working in the industry. No cold messages — shared rooms."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ opacity, scale }}
        className="mt-6 relative w-full max-w-3xl aspect-[16/9] mx-auto px-6"
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 62" preserveAspectRatio="none">
          {schools.map((a, i) =>
            schools.slice(i + 1).map((b, j) => (
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
        {schools.map((s, i) => (
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

  const people = [
    { name: "Maya Chen", role: "Director / NYU '23", credit: "Now in post on 'Soft Static' (short)", img: audience1 },
    { name: "Daniel Park", role: "Composer / USC '24", credit: "Released single 'Inland Sea' — Spotify", img: winner },
    { name: "Sofia Rivera", role: "Actor / Juilliard '22", credit: "Booked recurring on Hulu pilot", img: community },
    { name: "Jules Okafor", role: "Producer / Tisch '21", credit: "Sundance Episodic Lab '26", img: panel },
  ];

  return (
    <div className="relative h-screen flex flex-col items-center justify-center overflow-hidden py-12">
      <StopHeader
        number="Stop 04 — Track"
        title={
          <>
            Track everyone you know
            <br />— and what they're <em className="italic text-accent-blue font-normal">working on</em>.
          </>
        }
        caption="Rolling, real-time credits. New roles, singles, productions — surfaced from your circle the moment they happen."
        progress={progress}
        range={[0, 0.15, 0.85, 1]}
      />
      <motion.div
        style={{ opacity, x }}
        className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl px-6 w-full"
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
              <div className="text-[10px] tracking-widest uppercase text-glow mb-1.5">
                ✦ Latest
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{p.credit}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------- FINAL CTA ---------- */
export function CTAStop() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
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
          <div className="relative grid grid-cols-2 mb-6 p-1 rounded-full bg-secondary/60">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-foreground"
              style={{ left: mode === "signup" ? "4px" : "calc(50% + 0px)" }}
            />
            <button
              onClick={() => setMode("signup")}
              className={`relative z-10 py-2.5 text-sm tracking-wide transition-colors ${mode === "signup" ? "text-background" : "text-muted-foreground"}`}
            >
              Create account
            </button>
            <button
              onClick={() => setMode("login")}
              className={`relative z-10 py-2.5 text-sm tracking-wide transition-colors ${mode === "login" ? "text-background" : "text-muted-foreground"}`}
            >
              Log in
            </button>
          </div>

          <form
            className="space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/auth");
            }}
          >
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-3.5 text-sm placeholder:text-muted-foreground outline-none focus:border-glow transition"
              />
            )}
            <input
              type="email"
              placeholder=".edu or alumni email"
              className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-3.5 text-sm placeholder:text-muted-foreground outline-none focus:border-glow transition"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-3.5 text-sm placeholder:text-muted-foreground outline-none focus:border-glow transition"
            />
            <button
              type="submit"
              className="group relative w-full mt-2 py-4 rounded-xl bg-foreground text-background font-medium tracking-wide overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {mode === "signup" ? "Create my account" : "Sign in"}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </button>
          </form>

          <p className="mt-5 text-[11px] text-muted-foreground">
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
