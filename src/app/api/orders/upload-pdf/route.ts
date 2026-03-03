import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { ObjectStorageService } from "@/lib/object-storage";

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let pdfUrl: string | null = null;
    try {
      const objectStorage = new ObjectStorageService();
      pdfUrl = await objectStorage.uploadBuffer(buffer, file.name || "order.pdf", "orders");
    } catch (storageError) {
      console.error("PDF storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to store PDF. Please ensure object storage is configured." },
        { status: 500 }
      );
    }

    return NextResponse.json({ pdfUrl });
  } catch (error: any) {
    console.error("PDF upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload PDF" }, { status: 500 });
  }
}
