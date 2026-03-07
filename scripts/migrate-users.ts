/**
 * One-time migration script: Create Supabase Auth users for existing CA_users
 * and populate email + supabase_uid columns.
 *
 * Prerequisites:
 * 1. Schema must be updated (email + supabase_uid columns added to CA_users)
 * 2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 * 3. DATABASE_URL must be set in .env.local
 *
 * Usage: npx tsx scripts/migrate-users.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sql = postgres(DATABASE_URL, { prepare: false });

// Map existing users to emails and passwords
const USER_CONFIGS: Record<string, { email: string; password: string }> = {
  "hello@eatwildbird.com": {
    email: "hello@eatwildbird.com",
    password: "O10az212",
  },
  admin: {
    email: "admin@wildbird.team",
    password: "WildbirdAdmin2024",
  },
};

async function main() {
  console.log("Fetching existing CA_users...");
  const users = await sql`SELECT id, username, name, role, email, supabase_uid FROM "CA_users" ORDER BY id`;

  console.log(`Found ${users.length} users:\n`);

  for (const user of users) {
    console.log(`--- User ${user.id}: ${user.username} (${user.name}) ---`);

    // Skip if already migrated
    if (user.supabase_uid) {
      console.log(`  Already has supabase_uid: ${user.supabase_uid}, skipping.`);
      continue;
    }

    const config = USER_CONFIGS[user.username];
    if (!config) {
      console.log(`  No config found for username "${user.username}", skipping.`);
      console.log(`  Add an entry to USER_CONFIGS in this script.`);
      continue;
    }

    // Check if Supabase Auth user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAuth = existingUsers?.users?.find((u) => u.email === config.email);

    let supabaseUid: string;

    if (existingAuth) {
      console.log(`  Supabase Auth user already exists for ${config.email}: ${existingAuth.id}`);
      supabaseUid = existingAuth.id;
    } else {
      // Create Supabase Auth user
      const { data: authUser, error } = await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
      });

      if (error) {
        console.error(`  Failed to create auth user: ${error.message}`);
        continue;
      }

      supabaseUid = authUser.user.id;
      console.log(`  Created Supabase Auth user: ${supabaseUid}`);
    }

    // Update CA_users with email and supabase_uid
    await sql`UPDATE "CA_users" SET email = ${config.email}, supabase_uid = ${supabaseUid} WHERE id = ${user.id}`;
    console.log(`  Updated CA_users: email=${config.email}, supabase_uid=${supabaseUid}`);
  }

  console.log("\nMigration complete!");
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
