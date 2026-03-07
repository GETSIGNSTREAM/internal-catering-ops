import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import postgres from "postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/sync/neon
 *
 * Syncs new & updated orders from the Replit Neon database into Supabase.
 * - Inserts orders with id > max existing id (new orders from Replit)
 * - Updates recent orders (last 48h) that may have status/assignment changes
 * Admin only.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const neonUrl = process.env.NEON_DATABASE_URL;
  const supabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!neonUrl) {
    return NextResponse.json({ error: "NEON_DATABASE_URL not configured" }, { status: 500 });
  }
  if (!supabaseUrl) {
    return NextResponse.json({ error: "No database URL configured" }, { status: 500 });
  }

  const neon = postgres(neonUrl, { prepare: false });
  const supa = postgres(supabaseUrl, { prepare: false });

  try {
    // Get max order ID in Supabase
    const [{ max_id }] = await supa`SELECT COALESCE(MAX(id), 0) as max_id FROM "CA_orders"`;

    // 1. Fetch NEW orders from Neon (not yet in Supabase)
    const newOrders = await neon`SELECT * FROM orders WHERE id > ${max_id} ORDER BY id ASC`;

    // 2. Fetch recently changed orders (last 48h by fulfillment or creation)
    const recentOrders = await neon`
      SELECT * FROM orders
      WHERE id <= ${max_id}
        AND (
          COALESCE(delivery_time, pickup_time) >= NOW() - interval '48 hours'
          OR created_at >= NOW() - interval '48 hours'
        )
      ORDER BY id ASC
    `;

    let inserted = 0;
    let updated = 0;

    // Insert new orders
    for (const o of newOrders) {
      const itemsJson = typeof o.items === "string" ? o.items : JSON.stringify(o.items || []);
      await supa`
        INSERT INTO "CA_orders" (
          id, order_number, customer_name, customer_email, customer_phone,
          organization, items, total_amount, order_source,
          pickup_time, delivery_time, ready_time,
          delivery_address, delivery_mode, status, prep_status,
          notes, utensils_requested, number_of_guests,
          assigned_store_id, assigned_gm_id, assigned_driver,
          photo_proof_url, pdf_url, labels_url,
          completed_at, created_at, menu_tbd
        ) VALUES (
          ${o.id}, ${o.order_number}, ${o.customer_name},
          ${o.customer_email}, ${o.customer_phone}, ${o.organization},
          ${itemsJson}::jsonb, ${o.total_amount}, ${o.order_source},
          ${o.pickup_time}, ${o.delivery_time}, ${o.ready_time},
          ${o.delivery_address}, ${o.delivery_mode},
          ${o.status}, ${o.prep_status},
          ${o.notes}, ${o.utensils_requested}, ${o.number_of_guests},
          ${o.assigned_store_id}, ${o.assigned_gm_id}, ${o.assigned_driver},
          ${o.photo_proof_url}, ${o.pdf_url}, ${o.labels_url},
          ${o.completed_at}, ${o.created_at}, ${o.menu_tbd ?? false}
        )
      `;
      inserted++;
    }

    // Update existing recent orders (sync status, assignments, etc.)
    for (const o of recentOrders) {
      const itemsJson = typeof o.items === "string" ? o.items : JSON.stringify(o.items || []);
      await supa`
        UPDATE "CA_orders" SET
          status = ${o.status},
          prep_status = ${o.prep_status},
          assigned_store_id = ${o.assigned_store_id},
          assigned_gm_id = ${o.assigned_gm_id},
          assigned_driver = ${o.assigned_driver},
          total_amount = ${o.total_amount},
          pickup_time = ${o.pickup_time},
          delivery_time = ${o.delivery_time},
          ready_time = ${o.ready_time},
          completed_at = ${o.completed_at},
          photo_proof_url = ${o.photo_proof_url},
          pdf_url = ${o.pdf_url},
          labels_url = ${o.labels_url},
          notes = ${o.notes},
          items = ${itemsJson}::jsonb,
          order_number = ${o.order_number},
          customer_name = ${o.customer_name},
          customer_email = ${o.customer_email},
          customer_phone = ${o.customer_phone},
          organization = ${o.organization},
          delivery_address = ${o.delivery_address},
          delivery_mode = ${o.delivery_mode},
          utensils_requested = ${o.utensils_requested},
          number_of_guests = ${o.number_of_guests}
        WHERE id = ${o.id}
      `;
      updated++;
    }

    // Reset sequence if new orders were inserted
    if (inserted > 0) {
      const [newMax] = await supa`SELECT MAX(id) as max_id FROM "CA_orders"`;
      if (newMax.max_id) {
        await supa`SELECT setval('"CA_orders_id_seq"', ${newMax.max_id})`;
      }
    }

    await neon.end();
    await supa.end();

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      maxIdBefore: max_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    try { await neon.end(); } catch {}
    try { await supa.end(); } catch {}
    console.error("Neon sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
