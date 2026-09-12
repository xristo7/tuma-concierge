import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is not set");
    }
    return encoder.encode("dev-only-insecure-secret-do-not-use-in-production");
  }
  return encoder.encode(secret);
}

export type AuthTokenPayload = {
  sub: string;
  role: "customer" | "rider" | "admin";
  phone: string;
};

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, phone: payload.phone })
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
    phone: payload.phone as string,
  };
}
