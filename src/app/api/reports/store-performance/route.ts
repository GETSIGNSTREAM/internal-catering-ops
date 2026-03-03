import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const performance = await storage.getStorePerformance();
    return NextResponse.json(performance);
  } catch (error) {
    console.error("Error fetching store performance:", error);
    return NextResponse.json({ error: "Failed to fetch store performance" }, { status: 500 });
  }
}
