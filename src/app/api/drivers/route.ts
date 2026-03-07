import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

/**
 * GET /api/drivers
 * Returns list of driver-role users (id + name only).
 * Accessible by any authenticated user (admins need this for order assignment).
 */
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const allUsers = await storage.getUsers();
    const drivers = allUsers
      .filter((u) => u.role === "driver")
      .map((u) => ({ id: u.id, name: u.name }));

    return NextResponse.json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }
}
