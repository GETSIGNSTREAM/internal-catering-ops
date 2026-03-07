import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { ObjectStorageService } from "@/lib/object-storage";
import { storage } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const order = await storage.getOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (session!.user.role !== "admin" && order.assignedStoreId !== session!.user.storeId) {
      return NextResponse.json({ error: "Access denied to this order" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo uploaded" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image size exceeds 5MB limit" }, { status: 400 });
    }

    const ext = file.type.split("/")[1] || "jpg";
    const filename = `order-${orderId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let photoUrl: string | null = null;
    try {
      const objectStorage = new ObjectStorageService();
      photoUrl = await objectStorage.uploadBuffer(buffer, filename, "order-photos");
    } catch (storageError) {
      console.error("Photo storage error:", storageError);
      return NextResponse.json({ error: "Failed to store photo" }, { status: 500 });
    }

    const completedAt = new Date();
    const updatedOrder = await storage.updateOrder(orderId, {
      photoProofUrl: photoUrl,
      completedAt: completedAt,
    });

    const checklists = await storage.getOrderChecklists(orderId);
    const photoTask = checklists.find((c) => c.taskType === "photo");
    if (photoTask && !photoTask.completed) {
      await storage.updateOrderChecklist(photoTask.id, {
        completed: true,
        completedAt: completedAt,
        completedBy: session!.user.id,
      });
    }

    return NextResponse.json({
      photoUrl,
      completedAt: completedAt.toISOString(),
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const order = await storage.getOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (session!.user.role !== "admin" && order.assignedStoreId !== session!.user.storeId) {
      return NextResponse.json({ error: "Access denied to this order" }, { status: 403 });
    }

    if (order.photoProofUrl) {
      try {
        const objectStorage = new ObjectStorageService();
        await objectStorage.deleteObject(order.photoProofUrl);
      } catch (err) {
        console.error("Failed to delete photo from storage:", err);
      }
    }

    await storage.updateOrder(orderId, {
      photoProofUrl: null,
      completedAt: null,
    });

    const checklists = await storage.getOrderChecklists(orderId);
    const photoTask = checklists.find((c) => c.taskType === "photo");
    if (photoTask && photoTask.completed) {
      await storage.updateOrderChecklist(photoTask.id, {
        completed: false,
        completedAt: null,
        completedBy: null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete photo" },
      { status: 500 }
    );
  }
}
