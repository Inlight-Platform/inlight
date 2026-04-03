import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import RequireAuth from "@/components/layout/RequireAuth";
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
import EventDetailPage from "./pages/EventDetailPage";
import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";
import AuthPage from "./pages/AuthPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ProjectNewPage from "./pages/ProjectNewPage";
import StageWhisperPage from "./pages/StageWhisperPage";
import GroupMembersPage from "./pages/GroupMembersPage";
import AdminPage from "./pages/AdminPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import MySavesPage from "./pages/MySavesPage";
import NotFound from "./pages/NotFound";
import NetworkPieChartPage from "./pages/NetworkPieChartPage";
import ShowcasePage from "./pages/ShowcasePage";
import ShowcaseProfilePage from "./pages/ShowcaseProfilePage";
import ShowcaseJoinPage from "./pages/ShowcaseJoinPage";

const queryClient = new QueryClient();

const AppShell = () => (
  <RequireAuth>
    <PageLayout>
      <Outlet />
    </PageLayout>
  </RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes - no shell */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/showcase/join/:programSlug" element={<ShowcaseJoinPage />} />
          <Route path="/showcase/:programId/:userId" element={<ShowcaseProfilePage />} />
          <Route path="/showcase/:programId" element={<ShowcasePage />} />

          {/* App shell (sidebar on desktop, bottom nav on mobile) */}
          <Route element={<AppShell />}>
            <Route path="/settings" element={<ProfileSettingsPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/directory/:badgeSlug" element={<DirectoryPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/mutuals" element={<PeoplePage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectNewPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/stage-whisper" element={<StageWhisperPage />} />
            <Route path="/company/:companyId" element={<CompanyProfilePage />} />
            <Route path="/saves" element={<MySavesPage />} />
            <Route path="/group" element={<GroupMembersPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
