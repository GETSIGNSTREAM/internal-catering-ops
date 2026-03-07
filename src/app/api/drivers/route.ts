import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { listDrivers } from "@/lib/supabase/users";

/**
 * GET /api/drivers
 * Returns list of driver-role users (id + name only).
 * Accessible by any authenticated user (admins need this for order assignment).
 */
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const drivers = await listDrivers();
    return NextResponse.json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }
}
