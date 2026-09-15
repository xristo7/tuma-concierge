type UserRow = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  role: "customer" | "rider" | "admin";
  phone_verified_at: string | null;
  email_verified_at: string | null;
  default_matching_mode: string | null;
};

/** Shapes a raw `users` row into the public `AuthUser` DTO. */
export function toAuthUser(row: Record<string, unknown>) {
  const r = row as unknown as UserRow;
  return {
    id: r.id,
    phone: r.phone,
    email: r.email ?? null,
    name: r.name,
    role: r.role,
    phoneVerifiedAt: r.phone_verified_at ?? null,
    emailVerifiedAt: r.email_verified_at ?? null,
    defaultMatchingMode: r.default_matching_mode ?? null,
  };
}
