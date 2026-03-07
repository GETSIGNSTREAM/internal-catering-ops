import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { CreateUserSchema } from "@/lib/validations";
import { listAuthUsers, createAuthUser } from "@/lib/supabase/users";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role");

    let allUsers = await listAuthUsers();

    if (roleFilter) {
      allUsers = allUsers.filter((u) => u.role === roleFilter);
    }

    const allStores = await storage.getStores();
    const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

    const usersWithStores = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      storeId: u.storeId,
      storeName: u.storeId ? storeMap.get(u.storeId) ?? null : null,
    }));

    return NextResponse.json(usersWithStores);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, name, role, storeId } = parsed.data;

    if (role !== "admin" && role !== "driver" && !storeId) {
      return NextResponse.json(
        { error: "Store assignment is required for GM users" },
        { status: 400 }
      );
    }

    const user = await createAuthUser({
      email,
      name,
      role: role ?? "gm",
      storeId: storeId ?? null,
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, role: user.role, storeId: user.storeId },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
