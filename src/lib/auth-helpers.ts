import { createServerAuthClient } from "./supabase/server-auth";
import { storage } from "./storage";
import { NextResponse } from "next/server";

export async function getAuthUser() {
  const supabase = await createServerAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser) return null;

  return {
    id: String(caUser.id),
    username: caUser.username,
    name: caUser.name,
    role: caUser.role,
    storeId: caUser.storeId,
    language: caUser.language || "en",
  };
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { session: { user } };
}

export async function requireAdmin() {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (result.session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return result;
}
