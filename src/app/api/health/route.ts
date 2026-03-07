import { NextResponse } from "next/server";
import postgres from "postgres";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { count, desc, sql as dsql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let rawCount = 0;
  let rawTodayCount = 0;
  let drizzleCount = 0;
  let drizzleTodayCount = 0;
  let drizzleSample: unknown[] = [];
  const errors: string[] = [];

  // Raw postgres query
  if (dbUrl) {
    const sql = postgres(dbUrl, { prepare: false });
    try {
      const [total] = await sql`SELECT COUNT(*) as cnt FROM "CA_orders"`;
      rawCount = Number(total.cnt);

      const [today] = await sql`
        SELECT COUNT(*) as cnt FROM "CA_orders"
        WHERE COALESCE(delivery_time, pickup_time) >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date::timestamp AT TIME ZONE 'America/Los_Angeles'
          AND COALESCE(delivery_time, pickup_time) < ((NOW() AT TIME ZONE 'America/Los_Angeles')::date + interval '1 day')::timestamp AT TIME ZONE 'America/Los_Angeles'
      `;
      rawTodayCount = Number(today.cnt);
      await sql.end();
    } catch (err: unknown) {
      errors.push("raw: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Drizzle query (same path as orders API)
  try {
    const [result] = await db.select({ total: count() }).from(orders);
    drizzleCount = result.total;

    // Replicate the "Today" filter from the client
    const now = new Date();
    const laDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const [year, month, day] = laDateStr.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, day, 8, 0, 0));
    const to = new Date(Date.UTC(year, month - 1, day + 1, 8, 0, 0));

    const todayOrders = await db.select({
      id: orders.id,
      customerName: orders.customerName,
      status: orders.status,
      pickupTime: orders.pickupTime,
      deliveryTime: orders.deliveryTime,
    }).from(orders).where(
      dsql`COALESCE(${orders.deliveryTime}, ${orders.pickupTime}) >= ${from} AND COALESCE(${orders.deliveryTime}, ${orders.pickupTime}) < ${to}`
    ).orderBy(desc(orders.id)).limit(5);

    drizzleTodayCount = todayOrders.length;
    drizzleSample = todayOrders;
  } catch (err: unknown) {
    errors.push("drizzle: " + (err instanceof Error ? err.message : String(err)));
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    raw: { orderCount: rawCount, todayCount: rawTodayCount },
    drizzle: { orderCount: drizzleCount, todayCount: drizzleTodayCount, sample: drizzleSample },
    errors: errors.length > 0 ? errors : undefined,
    dbHost: dbUrl?.match(/@([^:\/]+)/)?.[1] || "none",
  });
}
