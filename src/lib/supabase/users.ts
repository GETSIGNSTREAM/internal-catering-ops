import { getAdminClient } from "./admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  storeId: number | null;
}

/**
 * List all users from Supabase Auth, normalized to AuthUser shape.
 */
export async function listAuthUsers(): Promise<AuthUser[]> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;

  return data.users.map(normalizeUser);
}

/**
 * Get a single user by Supabase Auth UUID.
 */
export async function getAuthUserById(uid: string): Promise<AuthUser | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(uid);
  if (error) return null;
  return normalizeUser(data.user);
}

/**
 * List only driver-role users.
 */
export async function listDrivers(): Promise<Pick<AuthUser, "id" | "name">[]> {
  const users = await listAuthUsers();
  return users
    .filter((u) => u.role === "driver")
    .map((u) => ({ id: u.id, name: u.name }));
}

/**
 * Create a new user in Supabase Auth with role/store metadata.
 * Uses a random password since the app uses magic-link auth.
 */
export async function createAuthUser(opts: {
  email: string;
  name: string;
  role: string;
  storeId?: number | null;
}): Promise<AuthUser> {
  const admin = getAdminClient();

  const randomPassword = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: randomPassword,
    email_confirm: true,
    app_metadata: {
      role: opts.role,
      store_id: opts.storeId ?? null,
    },
    user_metadata: {
      name: opts.name,
    },
  });

  if (error) {
    // If user already exists, find and update them instead
    if (error.message?.includes("already been registered") || (error as any).status === 422) {
      const { data: listData } = await admin.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === opts.email);
      if (!existing) {
        throw new Error(`Auth user exists but could not be found: ${error.message}`);
      }
      // Update their metadata to match
      await admin.auth.admin.updateUserById(existing.id, {
        app_metadata: { role: opts.role, store_id: opts.storeId ?? null },
        user_metadata: { name: opts.name },
      });
      return normalizeUser(existing);
    }
    throw error;
  }

  return normalizeUser(data.user);
}

/**
 * Update an existing user's metadata in Supabase Auth.
 */
export async function updateAuthUser(
  uid: string,
  updates: {
    email?: string;
    name?: string;
    role?: string;
    storeId?: number | null;
  }
): Promise<AuthUser> {
  const admin = getAdminClient();

  const authUpdates: Record<string, any> = {};
  const appMetaUpdates: Record<string, any> = {};
  const userMetaUpdates: Record<string, any> = {};

  if (updates.email !== undefined) authUpdates.email = updates.email;
  if (updates.role !== undefined) appMetaUpdates.role = updates.role;
  if (updates.storeId !== undefined) appMetaUpdates.store_id = updates.storeId;
  if (updates.name !== undefined) userMetaUpdates.name = updates.name;

  if (Object.keys(appMetaUpdates).length > 0) {
    authUpdates.app_metadata = appMetaUpdates;
  }
  if (Object.keys(userMetaUpdates).length > 0) {
    authUpdates.user_metadata = userMetaUpdates;
  }

  const { data, error } = await admin.auth.admin.updateUserById(uid, authUpdates);
  if (error) throw error;

  return normalizeUser(data.user);
}

/**
 * Delete a user from Supabase Auth.
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) throw error;
}

/** Map a Supabase Auth user to our normalized shape. */
function normalizeUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.name as string) || user.email || "Unknown",
    role: (user.app_metadata?.role as string) || "gm",
    storeId: (user.app_metadata?.store_id as number) ?? null,
  };
}
