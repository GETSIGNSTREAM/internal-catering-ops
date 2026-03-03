import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parsePdf } from "@/lib/pdf-parser";
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
    const parsedData = await parsePdf(buffer);

    let pdfUrl: string | null = null;
    let storageWarning: string | undefined;
    try {
      const objectStorage = new ObjectStorageService();
      pdfUrl = await objectStorage.uploadBuffer(buffer, file.name || "order.pdf");
    } catch (storageError: any) {
      console.error("PDF storage error:", storageError);
      storageWarning = "PDF was parsed but could not be stored. You can re-upload it after creating the order.";
    }

    return NextResponse.json({ ...parsedData, pdfUrl, storageWarning });
  } catch (error: any) {
    console.error("PDF parsing error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse PDF" }, { status: 400 });
  }
}
