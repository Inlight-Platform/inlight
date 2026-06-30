import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/bmp",
]);

function sanitizeFileName(name: string) {
  return (name || "company-image")
    .trim()
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "company-image";
}

function base64ToBytes(value: string) {
  const clean = value.includes(",") ? value.split(",").pop()! : value;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { token, fileName, contentType, fileBase64, kind } = await req.json();
    const cleanToken = String(token || "").trim();
    const uploadKind = String(kind || "image");
    const mimeType = String(contentType || "application/octet-stream").toLowerCase();

    if (!cleanToken || !fileBase64) {
      return new Response(JSON.stringify({ error: "token and fileBase64 are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      return new Response(JSON.stringify({ error: "Only image uploads are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accessRows, error: accessError } = await supabase.rpc(
      "validate_company_staff_access",
      { _token: cleanToken },
    );

    if (accessError || !accessRows?.length) {
      return new Response(JSON.stringify({ error: accessError?.message || "Invalid access token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = accessRows[0].company_id as string;
    const bytes = base64ToBytes(String(fileBase64));
    const path = `company-staff/${companyId}/${uploadKind}-${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(String(fileName || "image"))}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage.from("profile-media").getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    let photoId: string | null = null;
    if (uploadKind === "photo") {
      const { data: insertedPhotoId, error: insertError } = await supabase.rpc(
        "add_company_photo_with_staff_token",
        { _token: cleanToken, _image_url: publicUrl, _caption: null },
      );

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      photoId = insertedPhotoId;
    }

    return new Response(JSON.stringify({ publicUrl, path, photoId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
