import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    // If not admin, scope to user's storeId
    let storeId: number | undefined;
    if (auth.session.user.role !== "admin") {
      storeId = auth.session.user.storeId ?? undefined;
    }

    const stats = await storage.getOrderStats(storeId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
