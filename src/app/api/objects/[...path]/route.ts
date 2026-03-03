import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { ObjectStorageService, ObjectNotFoundError } from "@/lib/object-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { path } = await params;
    const objectPath = `/objects/${path.join("/")}`;

    const objectStorage = new ObjectStorageService();
    const buffer = await objectStorage.getObjectBuffer(objectPath);
    const { contentType, filename } = objectStorage.getObjectMetadata(objectPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Error serving object:", err);
    if (err instanceof ObjectNotFoundError) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
