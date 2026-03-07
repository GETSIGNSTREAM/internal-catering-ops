import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { storage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerAuthClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No supabase user", authError: authError?.message }, { status: 401 });
  }

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser) {
    // Debug: list all CA_users to see what supabase_uids exist
    const allUsers = await storage.getUsers();
    const userSummary = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      supabaseUid: u.supabaseUid,
      email: u.email,
    }));
    return NextResponse.json({
      error: "No CA_user found for supabase_uid",
      supabaseUid: user.id,
      supabaseEmail: user.email,
      existingUsers: userSummary,
    }, { status: 403 });
  }

  return NextResponse.json({
    id: String(caUser.id),
    username: caUser.username,
    name: caUser.name,
    role: caUser.role,
    storeId: caUser.storeId,
    language: caUser.language || "en",
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
