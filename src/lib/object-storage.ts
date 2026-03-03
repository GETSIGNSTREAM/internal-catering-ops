import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}

const BUCKET_NAME = "order-files";

const FOLDER_MAP: Record<string, string> = {
  orders: "pdfs",
  labels: "labels",
  "order-photos": "photos",
};

export class ObjectStorageService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabase();
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    folder: string = "orders"
  ): Promise<string> {
    const objectId = randomUUID();
    const extension = filename.split(".").pop() || "pdf";
    const storageFolder = FOLDER_MAP[folder] || folder;
    const storagePath = `${storageFolder}/${objectId}.${extension}`;
    const mimeType = this.getMimeType(extension);
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (error) {
      console.error("Supabase upload error:", error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    return `/objects/${storagePath}`;
  }

  async getObjectBuffer(objectPath: string): Promise<Buffer> {
    const storagePath = this.toStoragePath(objectPath);
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);
    if (error || !data) {
      console.error("Supabase download error:", error?.message);
      throw new ObjectNotFoundError();
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getSignedUrl(
    objectPath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const storagePath = this.toStoragePath(objectPath);
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);
    if (error || !data?.signedUrl) {
      throw new ObjectNotFoundError();
    }
    return data.signedUrl;
  }

  async deleteObject(objectPath: string): Promise<void> {
    const storagePath = this.toStoragePath(objectPath);
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);
    if (error) {
      console.error("Supabase delete error:", error.message);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  getObjectMetadata(objectPath: string): {
    contentType: string;
    filename: string;
  } {
    const storagePath = this.toStoragePath(objectPath);
    const filename = storagePath.split("/").pop() || "file";
    const extension = filename.split(".").pop() || "";
    const contentType = this.getMimeType(extension);
    return { contentType, filename };
  }

  private toStoragePath(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    return objectPath.replace("/objects/", "");
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
  }
}
