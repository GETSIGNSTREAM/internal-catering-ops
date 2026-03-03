import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./src/lib/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: [
    "CA_users",
    "CA_stores",
    "CA_orders",
    "CA_order_checklists",
    "CA_push_subscriptions",
    "CA_app_settings",
    "CA_user_sessions",
  ],
});
