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

    const reports = await storage.getSalesReports(storeId);
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error fetching sales reports:", error);
    return NextResponse.json({ error: "Failed to fetch sales reports" }, { status: 500 });
  }
}
