// filepath: supabase/functions/badges-update-icon/index.ts
// Purpose: Update badge icon URL with service role key to bypass RLS
// Called from admin portal when uploading badge icons

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateIconRequest {
  badge_id: string;
  icon_url: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract and verify JWT token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is admin
    const isAdmin = user.user_metadata?.is_admin === true;
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: UpdateIconRequest = await req.json();
    const { badge_id, icon_url } = body;

    // Validate input
    if (!badge_id || !icon_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: badge_id, icon_url" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update badge with service role (bypasses RLS)
    const { data, error } = await supabase
      .from("badges")
      .update({
        icon_url: icon_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", badge_id)
      .select();

    if (error) {
      console.error("[badges-update-icon] Update error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to update badge icon",
          details: error.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log audit entry
    try {
      await supabase.from("badge_audit_logs").insert({
        badge_id: badge_id,
        user_id: user.id,
        admin_id: user.id,
        action_type: "config_change",
        reason: "Icon uploaded from admin portal",
        metadata: { icon_url: icon_url }
      });
    } catch (auditError) {
      console.warn("[badges-update-icon] Audit log error:", auditError);
      // Don't fail the request if audit log fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Badge icon updated successfully",
        badge_id: badge_id,
        icon_url: icon_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[badges-update-icon] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
