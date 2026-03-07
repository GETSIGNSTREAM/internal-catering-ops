import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let orderCount = 0;
  let todayCount = 0;
  let dbError = "";

  if (dbUrl) {
    const sql = postgres(dbUrl, { prepare: false });
    try {
      const [total] = await sql`SELECT COUNT(*) as cnt FROM "CA_orders"`;
      orderCount = Number(total.cnt);

      // Check today's orders using LA timezone logic
      const [today] = await sql`
        SELECT COUNT(*) as cnt FROM "CA_orders"
        WHERE COALESCE(delivery_time, pickup_time) >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date::timestamp AT TIME ZONE 'America/Los_Angeles'
          AND COALESCE(delivery_time, pickup_time) < ((NOW() AT TIME ZONE 'America/Los_Angeles')::date + interval '1 day')::timestamp AT TIME ZONE 'America/Los_Angeles'
      `;
      todayCount = Number(today.cnt);

      await sql.end();
    } catch (err: any) {
      dbError = err.message;
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    orderCount,
    todayCount,
    dbError: dbError || undefined,
    dbHost: dbUrl?.match(/@([^:\/]+)/)?.[1] || "none",
  });
}
