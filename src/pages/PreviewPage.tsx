import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Sparkle } from "@/components/Sparkle";
import logo from "@/assets/inlight-logo.jpeg";
import audience1 from "@/assets/audience-1.jpg";
import audience2 from "@/assets/audience-2.jpg";
import community from "@/assets/community.jpg";
import winner from "@/assets/winner.jpg";
import panel from "@/assets/panel.jpg";
import collage from "@/assets/collage.jpg";

const ROLES = ["Actor", "Director", "Songwriter", "Producer", "Dancer", "Composer", "Writer", "Designer"];
const SCHOOLS = ["NYU Tisch", "Juilliard", "USC SCA", "Berklee", "Yale Drama", "CalArts", "AFI", "Other"];
const GOALS = [
  "Finding Crew",
  "Professional Networking",
  "Funding Projects",
  "Booking Auditions",
  "Releasing Music",
];

type Survey = { role: string; school: string; goal: string };

export default function PreviewPage() {
  const [survey, setSurvey] = useState<Survey | null>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Inlight — Live Preview";
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Step inside Inlight without an account — a tailored preview of the interactive network for entertainment students and alumni."
    );
    return () => {
      document.title = prevTitle;
      if (meta && prev) meta.setAttribute("content", prev);
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[oklch(0.99_0.005_250)] text-[oklch(0.18_0.02_265)] overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(0.1 0 0) 1px, transparent 0)",
          backgroundSize: "4px 4px",
        }}
      />

      <nav className="fixed top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between bg-[oklch(0.99_0.005_250)]/80 backdrop-blur-md border-b border-[oklch(0.1_0_0/0.06)]">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Inlight" className="h-7 w-7 rounded-full object-cover" />
        </Link>
        <div className="hidden sm:block text-[10px] tracking-[0.4em] uppercase text-[oklch(0.4_0_0)]">
          Live Preview · No account required
        </div>
        <Link
          to="/"
          className="text-[10px] tracking-[0.3em] uppercase px-3 py-2 rounded-full border border-[oklch(0.1_0_0/0.15)] hover:bg-[oklch(0.1_0_0)] hover:text-white transition"
        >
          ← Back
        </Link>
      </nav>

      <AnimatePresence mode="wait">
        {!survey ? (
          <SurveyFlow key="survey" onComplete={setSurvey} />
        ) : (
          <PreviewExperience key="preview" survey={survey} />
        )}
      </AnimatePresence>

      <Link to="/#cta" className="fixed bottom-6 right-6 z-50 group">
        <motion.div
          animate={{ boxShadow: ["0 0 0 0 oklch(0.1 0 0 / 0.3)", "0 0 0 14px oklch(0.1 0 0 / 0)"] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="rounded-full"
        >
          <div className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-[oklch(0.12_0.02_265)] text-white text-sm tracking-wide shadow-2xl group-hover:scale-[1.03] transition-transform">
            <Sparkle size={14} />
            Create an account
            <span className="opacity-60 group-hover:translate-x-0.5 transition">→</span>
          </div>
        </motion.div>
      </Link>
    </main>
  );
}

function SurveyFlow({ onComplete }: { onComplete: (s: Survey) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Survey>>({});

  const steps = [
    { key: "role" as const, q: "What's your role in the industry?", options: ROLES },
    { key: "school" as const, q: "Where did you study?", options: SCHOOLS },
    { key: "goal" as const, q: "What do you want to move forward?", options: GOALS },
  ];
  const current = steps[step];

  const pick = (v: string) => {
    const next = { ...answers, [current.key]: v };
    setAnswers(next);
    if (step < steps.length - 1) {
      setTimeout(() => setStep(step + 1), 280);
    } else {
      setTimeout(() => onComplete(next as Survey), 500);
    }
  };

  return (
    <motion.section
      exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24"
    >
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex gap-2">
        {steps.map((_, i) => (
          <motion.span
            key={i}
            animate={{ width: i === step ? 32 : 8, opacity: i <= step ? 1 : 0.25 }}
            className="h-[2px] bg-[oklch(0.12_0.02_265)] rounded-full"
          />
        ))}
      </div>

      <div className="max-w-3xl w-full text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
            exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-[10px] tracking-[0.4em] uppercase text-[oklch(0.45_0_0)] mb-6">
              Step {step + 1} of {steps.length}
            </div>
            <h1 className="font-editorial text-5xl sm:text-7xl leading-[1] tracking-tight">
              {current.q}
            </h1>

            <div className="mt-14 flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
              {current.options.map((opt, i) => (
                <motion.button
                  key={opt}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pick(opt)}
                  className={`px-5 py-3 rounded-full border text-sm transition-all ${
                    answers[current.key] === opt
                      ? "bg-[oklch(0.12_0.02_265)] text-white border-[oklch(0.12_0.02_265)]"
                      : "border-[oklch(0.1_0_0/0.15)] hover:border-[oklch(0.1_0_0/0.5)] bg-white/60 backdrop-blur"
                  }`}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function PreviewExperience({ survey }: { survey: Survey }) {
  const [tab, setTab] = useState<"you" | "all">("you");

  return (
    <motion.section
      initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative pt-32 pb-40 px-6"
    >
      <div className="sticky top-20 z-40 flex justify-center mb-16">
        <LayoutGroup>
          <div className="relative flex p-1 rounded-full bg-white/70 backdrop-blur-xl border border-[oklch(0.1_0_0/0.08)] shadow-[0_8px_30px_-12px_oklch(0.1_0_0/0.2)]">
            {(["you", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative px-8 py-2.5 text-xs tracking-[0.3em] uppercase z-10"
              >
                {tab === t && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-[oklch(0.12_0.02_265)] rounded-full -z-10"
                  />
                )}
                <span className={tab === t ? "text-white" : "text-[oklch(0.3_0_0)]"}>{t}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <AnimatePresence mode="wait">
        {tab === "you" ? <YouTab key="you" survey={survey} /> : <AllTab key="all" />}
      </AnimatePresence>

      <DailyMatch survey={survey} />
    </motion.section>
  );
}

const MATCH_POOL = [
  { img: audience1, name: "Elena Voss", role: "Director", school: "NYU Tisch · '23", location: "Brooklyn, NY", bio: "Magical-realist shorts about diaspora and weather. Currently scouting a DP for a 16mm thesis shooting in late winter.", tags: ["Short film", "16mm", "Crew call"] },
  { img: winner, name: "Marcus Reyes", role: "Composer", school: "Berklee · '24", location: "Los Angeles, CA", bio: "Scoring indie features and one very strange video game. Looking for a lyricist who likes ambient pop and isn't afraid of a 7/8 bar.", tags: ["Scoring", "Sync", "Co-write"] },
  { img: community, name: "Priya Anand", role: "Producer", school: "USC SCA · '22", location: "Brooklyn, NY", bio: "Producing across documentary and narrative. Currently packaging a Sundance Lab finalist and hunting for a co-producer with grant chops.", tags: ["Grants", "Packaging", "Doc"] },
  { img: panel, name: "Theo Lambert", role: "Writer", school: "Yale Drama · '23", location: "Remote", bio: "Plays about small towns and large lies. Open to a writers' room swap and trading drafts for honest, bruising notes.", tags: ["Playwriting", "Notes swap", "Adaptation"] },
  { img: collage, name: "Yui Tanaka", role: "Designer", school: "CalArts · '24", location: "Los Angeles, CA", bio: "Production design rooted in textiles and built environments. Open to a short film or music video with a strong color point of view.", tags: ["Production design", "Music video", "Short"] },
];

function DailyMatch({ survey }: { survey: Survey }) {
  const [index, setIndex] = useState(0);
  const match = MATCH_POOL[index % MATCH_POOL.length];
  const next = () => setIndex((i) => i + 1);

  return (
    <section className="max-w-6xl mx-auto mt-40 px-2">
      <div className="mb-10 text-center">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[oklch(0.45_0_0)] mb-3">
          Daily match · for {survey.role.toLowerCase()}s chasing {survey.goal.toLowerCase()}
        </div>
        <h3 className="font-editorial text-4xl sm:text-6xl leading-[1.05] tracking-tight">
          One person, <em className="italic">picked for today</em>.
        </h3>
      </div>

      <div className="relative mx-auto max-w-md">
        <AnimatePresence mode="wait">
          <motion.article
            key={match.name}
            initial={{ opacity: 0, y: 30, rotateX: -8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0)" }}
            exit={{ opacity: 0, y: -30, rotateX: 8, filter: "blur(8px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1200 }}
            className="relative rounded-[28px] overflow-hidden border border-[oklch(0.1_0_0/0.08)] bg-white shadow-[0_30px_80px_-30px_oklch(0.1_0.05_265/0.45)]"
          >
            <motion.div
              aria-hidden
              animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
              transition={{ duration: 6, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
              className="pointer-events-none absolute inset-0 z-20 mix-blend-overlay opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(115deg, transparent 30%, oklch(0.95 0.15 320 / 0.35) 45%, oklch(0.95 0.15 220 / 0.35) 55%, transparent 70%)",
                backgroundSize: "250% 250%",
              }}
            />
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={match.img} alt={match.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute top-5 left-5 right-5 flex items-start justify-between text-white">
                <div className="text-[9px] tracking-[0.4em] uppercase opacity-80">
                  Inlight · Daily Match
                </div>
                <div className="text-[9px] tracking-[0.3em] uppercase px-2 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
                  #{String(index + 1).padStart(3, "0")}
                </div>
              </div>
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <div className="text-[10px] tracking-[0.35em] uppercase opacity-80">
                  {match.role} · {match.school}
                </div>
                <div className="font-editorial text-4xl leading-[1.05] mt-1">{match.name}</div>
                <div className="text-xs opacity-70 mt-1">{match.location}</div>
              </div>
            </div>

            <div className="relative p-6 sm:p-7">
              <p className="text-[15px] leading-relaxed text-[oklch(0.25_0_0)]">{match.bio}</p>

              <div className="flex flex-wrap gap-1.5 mt-5">
                {match.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-[oklch(0.1_0_0/0.12)] text-[oklch(0.35_0_0)]"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={next}
                  className="py-3 rounded-full border border-[oklch(0.1_0_0/0.15)] text-xs tracking-[0.3em] uppercase hover:bg-[oklch(0.96_0_0)] transition">
                  View profile
                </motion.button>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={next}
                  className="py-3 rounded-full bg-[oklch(0.12_0.02_265)] text-white text-xs tracking-[0.3em] uppercase hover:bg-black transition flex items-center justify-center gap-2">
                  <Sparkle size={11} />
                  Connect
                </motion.button>
              </div>

              <button onClick={next}
                className="block mx-auto mt-5 text-[10px] tracking-[0.3em] uppercase text-[oklch(0.5_0_0)] hover:text-[oklch(0.15_0_0)] transition">
                Skip → next match
              </button>
            </div>
          </motion.article>
        </AnimatePresence>

        <div aria-hidden className="absolute inset-x-6 -bottom-3 h-12 rounded-[28px] bg-white/60 border border-[oklch(0.1_0_0/0.06)] -z-10" />
        <div aria-hidden className="absolute inset-x-12 -bottom-6 h-12 rounded-[28px] bg-white/30 border border-[oklch(0.1_0_0/0.04)] -z-20" />
      </div>
    </section>
  );
}

function YouTab({ survey }: { survey: Survey }) {
  const goalContent: Record<string, { title: string; items: { title: string; meta: string }[] }> = {
    "Finding Crew": { title: "Sets near you, hiring now", items: [
      { title: "Untitled thesis — needs 1st AC", meta: "Brooklyn · shoots Nov 22–24" },
      { title: "Music video — gaffer + grip", meta: "LA · weekend shoot, paid" },
      { title: "Short doc — sound mixer", meta: "Remote interviews · flexible" },
    ]},
    "Professional Networking": { title: "Mixers and talkbacks this month", items: [
      { title: "A24 producers on indie financing", meta: "Virtual · Thu 7pm ET" },
      { title: "Alumni mixer — Lower East Side", meta: "RSVP via Inlight · Sat" },
      { title: "Casting director office hours", meta: "1:1 sign-ups open" },
    ]},
    "Funding Projects": { title: "Grants and labs accepting submissions", items: [
      { title: "Sundance Episodic Lab '26", meta: "Deadline Dec 1" },
      { title: "NYSCA Individual Artist Grant", meta: "Up to $15k · rolling" },
      { title: "Inlight x Tribeca seed pitch", meta: "Pitch night · Jan 18" },
    ]},
    "Booking Auditions": { title: "Self-tape calls in your range", items: [
      { title: "Hulu pilot — recurring guest", meta: "Sides released · due Fri" },
      { title: "Off-Broadway revival ensemble", meta: "In-person callbacks" },
      { title: "Indie feature lead — Sundance alum dir.", meta: "Tape only" },
    ]},
    "Releasing Music": { title: "Release windows and sync calls", items: [
      { title: "A&R listening session — Berklee alumni", meta: "Submit a single" },
      { title: "Sync brief — coming-of-age trailer", meta: "Indie folk · $$$" },
      { title: "Mastering swap with USC Thornton", meta: "Trade credits" },
    ]},
  };

  const focus = goalContent[survey.goal] ?? goalContent["Professional Networking"];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="max-w-6xl mx-auto space-y-32">
      <div className="text-center max-w-3xl mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[oklch(0.45_0_0)] mb-5">
          Welcome — your ecosystem
        </div>
        <h2 className="font-editorial text-5xl sm:text-7xl leading-[1.05] tracking-tight">
          A network shaped for a{" "}
          <em className="italic">{survey.role.toLowerCase()}</em> from{" "}
          <em className="italic">{survey.school}</em>.
        </h2>
      </div>

      <Module eyebrow="Your school network" title={`Active inside ${survey.school}`}>
        <div className="grid sm:grid-cols-3 gap-px bg-[oklch(0.1_0_0/0.08)] rounded-3xl overflow-hidden">
          {[
            { img: audience1, name: "Maya Chen", role: "Director · '23", note: "Now in post on 'Soft Static'" },
            { img: winner, name: "Daniel Park", role: "Composer · '24", note: "Released 'Inland Sea' on Spotify" },
            { img: community, name: "Sofia Rivera", role: "Actor · '22", note: "Booked recurring on Hulu pilot" },
          ].map((p) => (
            <motion.div key={p.name} whileHover={{ y: -4 }} className="bg-white p-8 group cursor-pointer">
              <div className="aspect-[4/5] overflow-hidden rounded-xl mb-5">
                <img src={p.img} alt={p.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-[1.03] transition-all duration-700" />
              </div>
              <div className="font-editorial text-2xl">{p.name}</div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[oklch(0.45_0_0)] mt-1">{p.role}</div>
              <div className="text-sm text-[oklch(0.35_0_0)] mt-3 leading-snug">{p.note}</div>
            </motion.div>
          ))}
        </div>
      </Module>

      <Module eyebrow={`Focus · ${survey.goal}`} title={focus.title}>
        <div className="divide-y divide-[oklch(0.1_0_0/0.08)] border-y border-[oklch(0.1_0_0/0.08)]">
          {focus.items.map((it, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-center justify-between py-7 group cursor-pointer">
              <div>
                <div className="font-editorial text-3xl sm:text-4xl group-hover:italic transition-all">{it.title}</div>
                <div className="text-xs tracking-wider text-[oklch(0.45_0_0)] mt-2">{it.meta}</div>
              </div>
              <span className="text-2xl opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition">→</span>
            </motion.div>
          ))}
        </div>
      </Module>
    </motion.div>
  );
}

function AllTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="max-w-6xl mx-auto space-y-32">
      <div className="text-center max-w-3xl mx-auto">
        <div className="text-[10px] tracking-[0.4em] uppercase text-[oklch(0.45_0_0)] mb-5">
          The global stream
        </div>
        <h2 className="font-editorial text-5xl sm:text-7xl leading-[1.05] tracking-tight">
          Every program, <em className="italic">every craft</em>, in motion.
        </h2>
      </div>

      <Module eyebrow="01 · Events" title="A slow timeline of what's next">
        <div className="relative pl-6 border-l border-[oklch(0.1_0_0/0.12)] space-y-10">
          {[
            { d: "Fri 12 Nov", t: "Tisch Senior Film Showcase", l: "Cantor Film Center · 7pm" },
            { d: "Sat 13 Nov", t: "Self-Tape Night w/ Casting Society", l: "USC SCA" },
            { d: "Sun 14 Nov", t: "Juilliard Composers' Concert", l: "Alice Tully Hall" },
            { d: "Thu 18 Nov", t: "A24 Producers Talkback", l: "Virtual · 6pm" },
          ].map((e, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="relative">
              <span className="absolute -left-[29px] top-2 h-2 w-2 rounded-full bg-[oklch(0.12_0.02_265)]" />
              <div className="text-[10px] tracking-[0.3em] uppercase text-[oklch(0.45_0_0)]">{e.d}</div>
              <div className="font-editorial text-3xl sm:text-4xl mt-1">{e.t}</div>
              <div className="text-sm text-[oklch(0.4_0_0)] mt-1">{e.l}</div>
            </motion.div>
          ))}
        </div>
      </Module>

      <Module eyebrow="02 · Projects" title="Ongoing, open to collaborators">
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { img: audience2, kind: "Short film · DP wanted", who: "NYU Tisch MFA" },
            { img: collage, kind: "Original musical · seeking lyricist", who: "USC Thornton" },
            { img: panel, kind: "Devised theatre · 4 performers", who: "Juilliard Drama" },
            { img: winner, kind: "EP rollout · cover art", who: "Berklee Alum" },
          ].map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -6 }} className="group cursor-pointer">
              <div className="aspect-[16/10] overflow-hidden rounded-2xl">
                <img src={p.img} alt={p.kind} className="h-full w-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[1200ms]" />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <div className="font-editorial text-2xl">{p.kind}</div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-[oklch(0.45_0_0)] mt-1">{p.who}</div>
                </div>
                <span className="text-sm opacity-40 group-hover:opacity-100">listen / view →</span>
              </div>
            </motion.div>
          ))}
        </div>
      </Module>

      <Module eyebrow="03 · Updates" title="What people are working on right now">
        <div className="space-y-px bg-[oklch(0.1_0_0/0.08)] border-y border-[oklch(0.1_0_0/0.08)]">
          {[
            { who: "Jules Okafor", what: "accepted into Sundance Episodic Lab '26", when: "2h ago" },
            { who: "Maya Chen", what: "locked picture on 'Soft Static'", when: "5h ago" },
            { who: "Daniel Park", what: "released new single 'Inland Sea'", when: "yesterday" },
            { who: "Sofia Rivera", what: "booked recurring guest on Hulu pilot", when: "2d ago" },
            { who: "Ana López", what: "opened a crew call for a short doc in Mexico City", when: "3d ago" },
          ].map((u, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="bg-white px-2 sm:px-6 py-5 flex items-baseline justify-between gap-4">
              <div className="text-base sm:text-lg">
                <span className="font-medium">{u.who}</span>{" "}
                <span className="text-[oklch(0.4_0_0)]">{u.what}.</span>
              </div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[oklch(0.55_0_0)] whitespace-nowrap">{u.when}</div>
            </motion.div>
          ))}
        </div>
      </Module>

      <Module eyebrow="04 · Industry" title="Trending alumni work — tickets open">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { img: community, t: "'Soft Static' — premiere", meta: "IFC Center · Dec 3", price: "$18" },
            { img: panel, t: "Composers Live", meta: "Le Poisson Rouge · Dec 9", price: "$25" },
            { img: audience1, t: "Devised Showcase '26", meta: "BAM Fisher · Jan 14", price: "$30" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="group">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl">
                <img src={s.img} alt={s.t} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="font-editorial text-2xl leading-tight">{s.t}</div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-[oklch(0.45_0_0)] mt-1">{s.meta}</div>
                </div>
                <button className="text-xs tracking-[0.2em] uppercase px-3 py-2 rounded-full border border-[oklch(0.1_0_0/0.2)] hover:bg-[oklch(0.12_0.02_265)] hover:text-white hover:border-transparent transition whitespace-nowrap">
                  {s.price}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Module>
    </motion.div>
  );
}

function Module({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-10 flex items-baseline justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[10px] tracking-[0.4em] uppercase text-[oklch(0.45_0_0)] mb-3">{eyebrow}</div>
          <h3 className="font-editorial text-3xl sm:text-5xl leading-[1.05] tracking-tight max-w-2xl">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}
