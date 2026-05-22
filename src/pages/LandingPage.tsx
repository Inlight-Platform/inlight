import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkle } from "@/components/Sparkle";
import { Starfield } from "@/components/Starfield";
import {
  ScrollSection,
  Hero,
  EventsStop,
  ProjectsStop,
  NetworkStop,
  TrackStop,
  CTAStop,
} from "@/components/scrollytelling";
import logo from "@/assets/inlight-logo.jpeg";

export default function LandingPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title =
      "Inlight — The Interactive Network for Entertainment Students & Alumni";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Inlight bridges the visibility gap in the creative economy — events, projects, and real-world connections inside your university entertainment network."
    );
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <main className="dark relative bg-background text-foreground">
      {/* persistent background */}
      <div className="fixed inset-0 -z-10 bg-night">
        <div className="absolute inset-0 bg-aurora opacity-70" />
        <Starfield density={120} />
      </div>

      {/* nav */}
      <nav className="fixed top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <img src={logo} alt="Inlight" className="h-8 w-8 rounded-full object-cover" />
        </a>
        <a
          href="#cta"
          className="text-xs tracking-[0.25em] uppercase px-4 py-2 rounded-full border border-border hover:border-glow hover:text-glow transition"
        >
          Sign in
        </a>
      </nav>

      {/* Scroll stops */}
      <ScrollSection>{(p) => <Hero progress={p} />}</ScrollSection>
      <ScrollSection>{(p) => <EventsStop progress={p} />}</ScrollSection>
      <ScrollSection>{(p) => <ProjectsStop progress={p} />}</ScrollSection>
      <ScrollSection>{(p) => <NetworkStop progress={p} />}</ScrollSection>
      <ScrollSection>{(p) => <TrackStop progress={p} />}</ScrollSection>

      {/* Live Preview invitation */}
      <section className="relative py-40 px-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-3xl text-center"
        >
          <div className="flex justify-center gap-2 mb-6 text-glow">
            <Sparkle size={16} className="opacity-60" />
            <Sparkle size={24} />
            <Sparkle size={12} className="opacity-40" />
          </div>
          <div className="text-[11px] tracking-[0.4em] uppercase text-muted-foreground mb-6">
            No account · no commitment
          </div>
          <h2 className="font-editorial text-white text-5xl sm:text-7xl md:text-8xl leading-[1.05] tracking-tight">
            Want to see it <em className="italic text-accent-blue font-normal">in motion?</em>
          </h2>
          <p className="mt-6 text-muted-foreground max-w-lg mx-auto">
            Take a tailored, three-question walk through the Inlight platform — fully interactive, no sign-up.
          </p>
          <Link
            to="/preview"
            className="group inline-flex items-center gap-3 mt-12 px-8 py-5 rounded-full bg-foreground text-background font-medium tracking-wide shadow-glow hover:scale-[1.03] transition-transform"
          >
            <Sparkle size={14} />
            Enter the live preview
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </motion.div>
      </section>

      <div id="cta">
        <CTAStop />
      </div>
    </main>
  );
}