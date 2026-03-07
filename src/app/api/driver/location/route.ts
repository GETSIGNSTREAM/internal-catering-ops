import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

/**
 * POST /api/driver/location
 * Receives GPS coordinates from a driver's device.
 * Auth required (driver role).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  if (auth.session.user.effectiveRole !== "driver" && auth.session.user.role !== "admin") {
    return NextResponse.json({ error: "Driver access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { latitude, longitude, accuracy, heading, speed, orderId } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 });
    }

    const driverId = parseInt(auth.session.user.id, 10);

    const location = await storage.createDriverLocation({
      driverId,
      orderId: orderId || null,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      heading: heading ?? null,
      speed: speed ?? null,
    });

    return NextResponse.json({ id: location.id }, { status: 201 });
  } catch (error) {
    console.error("Error saving driver location:", error);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}

/**
 * GET /api/driver/location
 * Returns the latest location for the authenticated driver.
 * Admins can pass ?driverId=X to get a specific driver's location.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    let driverId: number;

    if (auth.session.user.role === "admin" || auth.session.user.effectiveRole === "admin") {
      const { searchParams } = new URL(request.url);
      const paramId = searchParams.get("driverId");
      driverId = paramId ? parseInt(paramId, 10) : parseInt(auth.session.user.id, 10);
    } else {
      driverId = parseInt(auth.session.user.id, 10);
    }

    const location = await storage.getLatestDriverLocation(driverId);
    if (!location) {
      return NextResponse.json({ error: "No location found" }, { status: 404 });
    }

    return NextResponse.json({
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      heading: location.heading,
      speed: location.speed,
      recordedAt: location.recordedAt,
    });
  } catch (error) {
    console.error("Error fetching driver location:", error);
    return NextResponse.json({ error: "Failed to fetch location" }, { status: 500 });
  }
}
