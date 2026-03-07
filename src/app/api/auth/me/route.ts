import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { storage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser) return NextResponse.json(null, { status: 403 });

  // Check for admin view-as override
  const viewAsCookie = request.cookies.get("viewAsRole")?.value;
  const viewAsRole = (caUser.role === "admin" && viewAsCookie) ? viewAsCookie : null;

  return NextResponse.json({
    id: String(caUser.id),
    username: caUser.username,
    name: caUser.name,
    role: caUser.role,
    storeId: caUser.storeId,
    language: caUser.language || "en",
    ...(viewAsRole && { viewAsRole }),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser) return NextResponse.json(null, { status: 403 });

  const body = await request.json();
  if (body.language) {
    await storage.updateUser(caUser.id, { language: body.language });
  }

  return NextResponse.json({ success: true });
}
