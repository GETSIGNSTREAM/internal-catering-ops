import { NextResponse } from "next/server";
import postgres from "postgres";

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
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 40) + "...",
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };

  if (debug === "auth") {
    try {
      const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
      const result = await sql`SELECT id, username, name, role, length(password) as pw_len FROM "CA_users" ORDER BY id`;
      base.users = result;
      await sql.end();
    } catch (err: any) {
      base.dbError = err.message;
      base.dbErrorCode = err.code;
      base.dbErrorFull = String(err);
    }
  }

  return NextResponse.json(base);
}
