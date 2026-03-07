import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { count, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function GET() {
  let dbStatus = "unknown";
  let orderCount = 0;
  let dbError = "";
  let sampleOrders: { id: number; customerName: string; orderSource: string | null; status: string }[] = [];
  const envInfo = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  try {
    const [result] = await db.select({ total: count() }).from(orders);
    orderCount = result.total;
    dbStatus = "connected";

    // Fetch 3 sample orders to verify data is accessible
    const samples = await db.select({
      id: orders.id,
      customerName: orders.customerName,
      orderSource: orders.orderSource,
      status: orders.status,
    }).from(orders).orderBy(desc(orders.id)).limit(3);
    sampleOrders = samples;
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
    sampleOrders,
    dbError: dbError || undefined,
    env: envInfo,
  });
}
