import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid checklist ID" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.completed !== undefined) {
      updateData.completed = Boolean(body.completed);
      if (body.completed) {
        updateData.completedAt = new Date();
        updateData.completedBy = parseInt(auth.session.user.id, 10);
      } else {
        updateData.completedAt = null;
        updateData.completedBy = null;
      }
    }

    const updated = await storage.updateOrderChecklist(id, updateData);
    if (!updated) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}
