import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
const configuredSecret = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters in production.");
}
const secret = new TextEncoder().encode(configuredSecret || "development-only-secret-change-me-32chars");
export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
  (await cookies()).set("royal_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
export async function getUser() {
  const token = (await cookies()).get("royal_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ? db.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true } }) : null;
  } catch { return null; }
}
export async function getBusinessContext() {
  const user = await getUser();
  if (!user) return null;
  const membership = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, include: { business: true } });
  return membership ? { user, membership, business: membership.business } : null;
}
export async function requireBusiness() {
  const context = await getBusinessContext();
  if (!context) throw new Error("UNAUTHORIZED");
  return context;
}
