import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { count } from "drizzle-orm";

export async function GET() {
  let dbStatus = "unknown";
  let orderCount = 0;
  let dbError = "";
  let envInfo = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  try {
    const [result] = await db.select({ total: count() }).from(orders);
    orderCount = result.total;
    dbStatus = "connected";
  } catch (err: any) {
    dbStatus = "error";
    dbError = err.message || String(err);
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    db: dbStatus,
    orderCount,
    dbError: dbError || undefined,
    env: envInfo,
  });
}
