import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env.local (or set the Worker var/secret).");
  }
  return encoder.encode(secret);
}

export type AuthTokenPayload = {
  sub: string;
  role: "customer" | "rider" | "admin";
  phone: string | null;
};

export async function signToken(payload: { sub: string; role: AuthTokenPayload["role"]; phone?: string | null }): Promise<string> {
  return new SignJWT({ role: payload.role, phone: payload.phone ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    sub: payload.sub as string,
    role: payload.role as AuthTokenPayload["role"],
    phone: (payload.phone as string | null | undefined) ?? null,
  };
}
