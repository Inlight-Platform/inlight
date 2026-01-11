import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT and get user ID from claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const viewerId = claimsData.claims.sub;

    // Parse request body to get profile ID
    const { profileId } = await req.json();
    
    if (!profileId || typeof profileId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid profile ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block self-views
    if (viewerId === profileId) {
      return new Response(
        JSON.stringify({ message: "Self-view blocked" }),
        { status: 204, headers: corsHeaders }
      );
    }

    // Check for existing view today (once per user per day limit)
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    const { data: existingView } = await supabase
      .from("profile_views")
      .select("id")
      .eq("viewer_id", viewerId)
      .eq("viewed_profile_id", profileId)
      .gte("viewed_at", startOfDay)
      .lte("viewed_at", endOfDay)
      .maybeSingle();

    if (existingView) {
      return new Response(
        JSON.stringify({ message: "View already recorded today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new profile view using service role for the insert
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertError } = await serviceClient
      .from("profile_views")
      .insert({
        viewer_id: viewerId,
        viewed_profile_id: profileId,
      });

    if (insertError) {
      console.error("Error inserting profile view:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record view" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "View recorded" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in track-profile-view:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
