import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug");

  const base: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    env: {
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };

  if (debug === "auth") {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          passwordLength: users.password,
          name: users.name,
          role: users.role,
        })
        .from(users);

      base.users = allUsers.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        passwordLength: u.passwordLength?.length ?? 0,
        passwordPrefix: u.passwordLength?.substring(0, 7) ?? "null",
      }));

      // Test bcrypt compare for user hello@eatwildbird.com
      const [testUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, "hello@eatwildbird.com"));
      if (testUser) {
        const match = await bcrypt.compare("O10az212", testUser.password);
        base.bcryptTest = {
          username: testUser.username,
          passwordStored: testUser.password.substring(0, 20) + "...",
          fullLength: testUser.password.length,
          matchResult: match,
        };
      }
    } catch (err: any) {
      base.dbError = err.message;
    }
  }

  return NextResponse.json(base);
}
