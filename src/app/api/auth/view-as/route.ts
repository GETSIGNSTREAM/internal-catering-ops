import { requireAdmin } from "@/lib/auth-helpers";
import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["admin", "gm", "driver"];

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { role, storeId } = body;

  const response = NextResponse.json({
    success: true,
    viewAsRole: role || null,
    viewAsStoreId: (role === "gm" && storeId) ? storeId : null,
  });

  if (!role || role === "admin") {
    // Clear all view-as cookies — back to real admin role
    response.cookies.set("viewAsRole", "", { maxAge: 0, path: "/" });
    response.cookies.set("viewAsStoreId", "", { maxAge: 0, path: "/" });
  } else if (VALID_ROLES.includes(role)) {
    // Set the view-as role cookie (8 hours)
    response.cookies.set("viewAsRole", role, {
      maxAge: 8 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });

    // If switching to GM view with a store, set the store cookie
    if (role === "gm" && storeId) {
      response.cookies.set("viewAsStoreId", String(storeId), {
        maxAge: 8 * 60 * 60,
        path: "/",
        sameSite: "lax",
      });
    } else {
      // Clear store cookie for non-GM views or GM without store
      response.cookies.set("viewAsStoreId", "", { maxAge: 0, path: "/" });
    }
  } else {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  return response;
}
