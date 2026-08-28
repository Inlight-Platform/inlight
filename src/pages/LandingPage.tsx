import { type CSSProperties, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Starfield } from "@/components/Starfield";
import { useForceTheme } from "@/hooks/useTheme";
import {
  Hero,
  EventsStop,
  ProjectsStop,
  NetworkStop,
  TrackStop,
  CTAStop,
} from "@/components/scrollytelling";
import { AuthSegmentedButton } from "@/components/auth/AuthSegmentedButton";
import logo from "@/assets/inlight-logo.jpeg";

function SectionWrapper({
  children,
  height = "120vh",
  mobileHeight = "135svh",
}: {
  children: (p: ReturnType<typeof useScroll>["scrollYProgress"]) => React.ReactNode;
  height?: string;
  mobileHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return (
    <div
      ref={ref}
      style={{
        "--landing-stop-height": height,
        "--landing-stop-mobile-height": mobileHeight,
      } as CSSProperties}
      className="relative h-[var(--landing-stop-mobile-height)] sm:h-[var(--landing-stop-height)]"
    >
      <div className="sticky top-0 h-[100svh] w-full sm:h-screen">{children(scrollYProgress)}</div>
    </div>
  );
}

export default function LandingPage() {
  // Landing page is designed exclusively in dark — always force it
  // regardless of the user's app-wide light/dark preference.
  useForceTheme("dark");
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const auroraY = useTransform(heroP, [0, 1], ["0%", "30%"]);

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
        <motion.div style={{ y: auroraY }} className="absolute inset-0 bg-aurora opacity-70" />
        <Starfield density={120} />
      </div>

      {/* nav */}
      <nav className="fixed top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <img src={logo} alt="Inlight" className="h-8 w-8 rounded-full object-cover" />
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/feed"
            className="inline-flex w-[8.75rem] items-center justify-center rounded-full bg-foreground px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-background shadow-glow transition-transform hover:scale-[1.03] sm:w-[13.75rem] sm:px-7 sm:tracking-[0.22em]"
          >
            <span className="sm:hidden">Explore</span>
            <span className="hidden sm:inline">Explore Inlight</span>
          </Link>
          <AuthSegmentedButton size="sm" />
        </div>
      </nav>

      {/* Hero */}
      <div ref={heroRef}>
        <Hero progress={heroP} />
      </div>

      {/* Scroll stops */}
      <SectionWrapper>{(p) => <EventsStop progress={p} />}</SectionWrapper>
      <SectionWrapper height="145vh" mobileHeight="300svh">{(p) => <ProjectsStop progress={p} />}</SectionWrapper>
      <SectionWrapper>{(p) => <NetworkStop progress={p} />}</SectionWrapper>
      <SectionWrapper height="145vh" mobileHeight="300svh">{(p) => <TrackStop progress={p} />}</SectionWrapper>

      <div id="cta">
        <CTAStop />
      </div>
    </main>
  );
}
