import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string } }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { key } = params;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
    }

    const value = await storage.getSetting(key);
    return NextResponse.json({ key, value });
  } catch (error) {
    console.error("Error fetching setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { key } = params;
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
    }

    const body = await request.json();
    if (body.value === undefined || body.value === null) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    await storage.setSetting(key, String(body.value));
    return NextResponse.json({ key, value: String(body.value) });
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
