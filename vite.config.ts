import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const CURRENT_SUPABASE_URL = "https://gbiostpdhvfxpppfqskw.supabase.co";
const CURRENT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaW9zdHBkaHZmeHBwcGZxc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzk5MzIsImV4cCI6MjA4MzY1NTkzMn0.JnNtO8ai56DAOPPxXbIcGYbWY1i4AB7xgqxdJprs_FA";
const CURRENT_SUPABASE_PROJECT_ID = "gbiostpdhvfxpppfqskw";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(CURRENT_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(CURRENT_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(CURRENT_SUPABASE_PROJECT_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
