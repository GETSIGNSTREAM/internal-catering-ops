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
      return NextResponse.json({ error: "No labels PDF file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let labelsUrl: string | null = null;
    try {
      const objectStorage = new ObjectStorageService();
      labelsUrl = await objectStorage.uploadBuffer(buffer, file.name || "labels.pdf", "labels");
    } catch (storageError) {
      console.error("Labels storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to store labels PDF. Please ensure object storage is configured." },
        { status: 500 }
      );
    }

    return NextResponse.json({ labelsUrl });
  } catch (error: any) {
    console.error("Labels upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload labels PDF" }, { status: 500 });
  }
}
