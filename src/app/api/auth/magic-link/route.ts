import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/magic-link
 *
 * Generates a magic link for cross-domain SSO from Wingman.
 * Wingman calls this endpoint server-side with the user's email,
 * then redirects the user to the returned URL.
 *
 * Headers:
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Body:
 *   { email: string, redirect?: string }
 *
 * Response:
 *   { url: string } — the magic link URL to redirect the user to
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using the service role key
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, redirect } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Generate a magic link for the user
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: redirect || `${request.nextUrl.origin}/api/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: `Failed to generate magic link: ${error.message}` },
        { status: 400 },
      );
    }

    // The link properties contain the token — build the full callback URL
    const callbackUrl = new URL("/api/auth/callback", request.nextUrl.origin);
    if (data.properties?.hashed_token) {
      // Use the verification URL from Supabase which includes the token
      const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${data.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(redirect || `${request.nextUrl.origin}/api/auth/callback`)}`;
      return NextResponse.json({ url: verifyUrl });
    }

    // Fallback: return the action link directly
    return NextResponse.json({ url: data.properties?.action_link || callbackUrl.toString() });
  } catch (error) {
    console.error("Magic link generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
