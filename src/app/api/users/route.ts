import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { CreateUserSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const allUsers = await storage.getUsers();
    const allStores = await storage.getStores();

    const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

    const usersWithStores = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
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

    const { username, password, name, role, storeId } = parsed.data;

    // Non-admin users must have a storeId
    if (role !== "admin" && !storeId) {
      return NextResponse.json(
        { error: "Store assignment is required for non-admin users" },
        { status: 400 }
      );
    }

    // Check for existing username
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await storage.createUser({
      username,
      password: hashedPassword,
      name,
      role: role ?? "gm",
      storeId: storeId ?? null,
    });

    return NextResponse.json(
      { id: user.id, username: user.username, name: user.name, role: user.role, storeId: user.storeId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
