import { createServerAuthClient } from "./supabase/server-auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function getAuthUser() {
  const supabase = await createServerAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Read role/storeId from Supabase app_metadata (set by admin API)
  const role = (user.app_metadata?.role as string) || "gm";
  const storeId = (user.app_metadata?.store_id as number) ?? null;
  const name = (user.user_metadata?.name as string) || user.email || "Unknown";
  const language = (user.user_metadata?.language as string) || "en";

  // Read viewAs cookies for admin role switching
  const cookieStore = await cookies();
  const viewAsRole = cookieStore.get("viewAsRole")?.value || null;
  const viewAsStoreId = cookieStore.get("viewAsStoreId")?.value || null;

  // Only honor viewAs if the user's real role is admin
  const isRealAdmin = role === "admin";
  const effectiveRole = (isRealAdmin && viewAsRole) ? viewAsRole : role;
  const effectiveStoreId = (isRealAdmin && viewAsRole === "gm" && viewAsStoreId)
    ? parseInt(viewAsStoreId, 10)
    : storeId;

  return {
    id: user.id, // Supabase UUID string — no more parseInt needed
    email: user.email,
    username: user.email,
    name,
    role,
    effectiveRole,
    storeId: effectiveStoreId,
    realStoreId: storeId,
    language,
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
  // Always check the real role, not effectiveRole
  if (result.session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return result;
}
