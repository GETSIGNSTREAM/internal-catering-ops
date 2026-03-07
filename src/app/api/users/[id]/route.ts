import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAuthUserById, updateAuthUser, deleteAuthUser } from "@/lib/supabase/users";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const uid = params.id;
    if (!uid) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const existingUser = await getAuthUserById(uid);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updates.name = body.name;
    }

    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !body.email.includes("@")) {
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
      }
      updates.email = body.email;
    }

    if (body.role !== undefined) {
      if (!["admin", "gm", "driver"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.storeId !== undefined) {
      updates.storeId = body.storeId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await updateAuthUser(uid, updates);

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      storeId: updated.storeId,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const uid = params.id;
    if (!uid) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Cannot delete self
    if (uid === auth.session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await deleteAuthUser(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
