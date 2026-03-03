import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdmin() {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (result.session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return result;
}
