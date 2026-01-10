import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProfilePage from "./pages/ProfilePage";
import DirectoryPage from "./pages/DirectoryPage";
import MutualsPage from "./pages/MutualsPage";
import NetworkPage from "./pages/NetworkPage";
import { 
  StoriesPage, 
  InsightsPage, 
  EventsPage, 
  OpportunitiesPage, 
  MessagesPage, 
  ResourcesPage 
} from "./pages/SpokePlaceholders";
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
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/directory/:badgeSlug" element={<DirectoryPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/mutuals" element={<MutualsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
