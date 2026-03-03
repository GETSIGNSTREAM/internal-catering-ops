import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};

    // Handle name update
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updateData.name = body.name;
    }

    // Handle username update (check uniqueness)
    if (body.username !== undefined) {
      if (typeof body.username !== "string" || body.username.length < 3) {
        return NextResponse.json(
          { error: "Username must be at least 3 characters" },
          { status: 400 }
        );
      }
      const existing = await storage.getUserByUsername(body.username);
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 400 }
        );
      }
      updateData.username = body.username;
    }

    // Handle role update
    if (body.role !== undefined) {
      if (!["admin", "gm"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = body.role;
    }

    // Handle storeId update
    if (body.storeId !== undefined) {
      updateData.storeId = body.storeId;
    }

    // Handle password update (hash if provided)
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(body.password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await storage.updateUser(id, updateData);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
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
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Cannot delete self
    if (String(id) === auth.session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const deleted = await storage.deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
