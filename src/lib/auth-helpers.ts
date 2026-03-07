import { createServerAuthClient } from "./supabase/server-auth";
import { storage } from "./storage";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = await createServerAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser) return null;

  // Read viewAs cookies for admin role switching
  const cookieStore = await cookies();
  const viewAsRole = cookieStore.get("viewAsRole")?.value || null;
  const viewAsStoreId = cookieStore.get("viewAsStoreId")?.value || null;

  // Only honor viewAs if the user's real DB role is admin
  const isRealAdmin = caUser.role === "admin";
  const effectiveRole = (isRealAdmin && viewAsRole) ? viewAsRole : caUser.role;
  const effectiveStoreId = (isRealAdmin && viewAsRole === "gm" && viewAsStoreId)
    ? parseInt(viewAsStoreId, 10)
    : caUser.storeId;

  return {
    id: String(caUser.id),
    username: caUser.username,
    name: caUser.name,
    role: caUser.role,
    effectiveRole,
    storeId: effectiveStoreId,
    realStoreId: caUser.storeId,
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
  // Always check the real DB role, not effectiveRole
  if (result.session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return result;
}
