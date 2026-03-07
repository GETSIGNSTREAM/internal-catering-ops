import { NextResponse } from "next/server";
import postgres from "postgres";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug");

  const base: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };

  if (debug === "auth") {
    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    base.connSource = process.env.DATABASE_URL ? "DATABASE_URL" : process.env.POSTGRES_URL ? "POSTGRES_URL" : "NONE";
    base.connPrefix = connStr?.substring(0, 50) + "...";

    try {
      const sql = postgres(connStr!, { prepare: false });
      const rows = await sql`SELECT id, username, password, name, role FROM "CA_users" ORDER BY id`;
      base.users = rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        name: r.name,
        role: r.role,
        pwLen: r.password.length,
        pwPrefix: r.password.substring(0, 10),
      }));

      // test bcrypt
      const user1 = rows.find((r: any) => r.username === "hello@eatwildbird.com");
      if (user1) {
        const match = await bcrypt.compare("O10az212", user1.password);
        base.bcryptTest = { match, pwPrefix: user1.password.substring(0, 15) };
      }

      await sql.end();
    } catch (err: any) {
      base.dbError = err.message;
    }
  }

  return NextResponse.json(base);
}
