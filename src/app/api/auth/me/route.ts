import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const role = (user.app_metadata?.role as string) || "gm";
  const storeId = (user.app_metadata?.store_id as number) ?? null;
  const name = (user.user_metadata?.name as string) || user.email || "Unknown";
  const language = (user.user_metadata?.language as string) || "en";

  // Check for admin view-as override
  const viewAsCookie = request.cookies.get("viewAsRole")?.value;
  const viewAsRole = (role === "admin" && viewAsCookie) ? viewAsCookie : null;

  const viewAsStoreIdCookie = request.cookies.get("viewAsStoreId")?.value;
  const viewAsStoreId = (role === "admin" && viewAsRole === "gm" && viewAsStoreIdCookie)
    ? parseInt(viewAsStoreIdCookie, 10)
    : null;

  return NextResponse.json({
    id: user.id,
    username: user.email,
    name,
    role,
    storeId,
    language,
    ...(viewAsRole && { viewAsRole }),
    ...(viewAsStoreId && { viewAsStoreId }),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const body = await request.json();
  if (body.language) {
    const supabaseAdmin = getAdminClient();
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, language: body.language },
    });
  }

  return NextResponse.json({ success: true });
}
