import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function main() {
  console.log("DATABASE_URL host:", process.env.DATABASE_URL?.match(/@([^:\/]+)/)?.[1]);

  // Check total orders
  const total = await sql`SELECT COUNT(*) as cnt FROM "CA_orders"`;
  console.log("Total CA_orders:", total[0].cnt);

  // Check today's orders (LA timezone = UTC-8)
  const todayOrders = await sql`
    SELECT id, order_number, customer_name, status, pickup_time, delivery_time, total_amount
    FROM "CA_orders"
    WHERE COALESCE(delivery_time, pickup_time)::date >= CURRENT_DATE - interval '1 day'
    ORDER BY COALESCE(delivery_time, pickup_time) ASC
    LIMIT 10
  `;
  console.log("\nRecent/today orders:", JSON.stringify(todayOrders, null, 2));

  // Check most recent orders by ID
  const recent = await sql`
    SELECT id, order_number, customer_name, status, created_at, order_source
    FROM "CA_orders"
    ORDER BY id DESC
    LIMIT 5
  `;
  console.log("\nMost recent by ID:", JSON.stringify(recent, null, 2));

  // Check if "Forkable" order exists (visible in Replit screenshot)
  const forkable = await sql`
    SELECT id, order_number, customer_name, status, pickup_time, total_amount
    FROM "CA_orders"
    WHERE customer_name ILIKE '%forkable%'
    ORDER BY id DESC
    LIMIT 3
  `;
  console.log("\nForkable orders:", JSON.stringify(forkable, null, 2));

  await sql.end();
}

main().catch(console.error);
