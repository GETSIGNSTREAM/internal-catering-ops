import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { storage } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["admin", "gm", "driver"];

export async function POST(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caUser = await storage.getUserBySupabaseUid(user.id);
  if (!caUser || caUser.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { role } = body;

  const response = NextResponse.json({ success: true, viewAsRole: role || null });

  if (!role || role === "admin") {
    // Clear the cookie — back to real admin role
    response.cookies.set("viewAsRole", "", { maxAge: 0, path: "/" });
  } else if (VALID_ROLES.includes(role)) {
    // Set the view-as cookie (8 hours)
    response.cookies.set("viewAsRole", role, {
      maxAge: 8 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });
  } else {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  return response;
}
