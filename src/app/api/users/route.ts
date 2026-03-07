import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { CreateUserSchema } from "@/lib/validations";
import { getAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role");

    let allUsers = await storage.getUsers();

    // Filter by role if specified (e.g., ?role=driver)
    if (roleFilter) {
      allUsers = allUsers.filter((u) => u.role === roleFilter);
    }

    const allStores = await storage.getStores();
    const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

    const usersWithStores = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
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

    // Non-admin/non-driver users must have a storeId
    if (role !== "admin" && role !== "driver" && !storeId) {
      return NextResponse.json(
        { error: "Store assignment is required for GM users" },
        { status: 400 }
      );
    }

    // Create or find Supabase Auth user (magic-link only — random password since they'll use OTP)
    const supabaseAdmin = getAdminClient();
    let supabaseUid: string;

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
    });

    if (authError) {
      // If user already exists in Supabase Auth, look them up and use their existing UID
      if (authError.message?.includes("already been registered") || authError.status === 422) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find((u) => u.email === email);
        if (!existingAuthUser) {
          return NextResponse.json(
            { error: `Auth user exists but could not be found: ${authError.message}` },
            { status: 400 }
          );
        }
        supabaseUid = existingAuthUser.id;
      } else {
        return NextResponse.json(
          { error: `Failed to create auth user: ${authError.message}` },
          { status: 400 }
        );
      }
    } else {
      supabaseUid = authUser.user.id;
    }

    // Set role in Supabase app_metadata so middleware can read from JWT
    const finalRole = role ?? "gm";
    await supabaseAdmin.auth.admin.updateUserById(supabaseUid, {
      app_metadata: { role: finalRole },
    });

    // Create CA_users record with Supabase UID
    const user = await storage.createUser({
      username: email,
      password: "magic-link-auth",
      email,
      supabaseUid,
      name,
      role: finalRole,
      storeId: storeId ?? null,
    });

    return NextResponse.json(
      { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, storeId: user.storeId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
