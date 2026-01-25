import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProfilePage from "./pages/ProfilePage";
import DirectoryPage from "./pages/DirectoryPage";
import PeoplePage from "./pages/PeoplePage";
import NetworkPage from "./pages/NetworkPage";
import FeedPage from "./pages/FeedPage";
import ResourcesPage from "./pages/ResourcesPage";
import InsightsPage from "./pages/InsightsPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import EventsPage from "./pages/EventsPage";
import MessagesPage from "./pages/MessagesPage";
import AuthPage from "./pages/AuthPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ProjectNewPage from "./pages/ProjectNewPage";
import StageWhisperPage from "./pages/StageWhisperPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/settings" element={<ProfileSettingsPage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/directory/:badgeSlug" element={<DirectoryPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/mutuals" element={<PeoplePage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectNewPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/stage-whisper" element={<StageWhisperPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
