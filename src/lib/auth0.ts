import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";

export const isAuth0Configured = Boolean(
  process.env.AUTH0_DOMAIN &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET &&
  process.env.AUTH0_SECRET,
);

function redirectTo(ctx: { appBaseUrl?: string }, path: string) {
  const baseUrl = ctx.appBaseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(path, baseUrl));
}

export const auth0 = isAuth0Configured
  ? new Auth0Client({
      async onCallback(error, ctx, session) {
        if (error || !session) return redirectTo(ctx, "/login?error=auth0");

        const emailResult = z.email().safeParse(session.user.email?.trim().toLowerCase());
        if (!emailResult.success || session.user.email_verified !== true) {
          return redirectTo(ctx, "/login?error=auth0-email");
        }

        const name = (session.user.name || session.user.nickname || emailResult.data.split("@")[0]).trim().slice(0, 80);
        const user = await db.user.upsert({
          where: { email: emailResult.data },
          update: {},
          create: {
            email: emailResult.data,
            name: name || "Business user",
            passwordHash: await bcrypt.hash(randomBytes(32).toString("base64url"), 12),
          },
          select: { id: true },
        });
        const hasWorkspace = await db.membership.count({ where: { userId: user.id } });
        const response = redirectTo(ctx, hasWorkspace ? "/dashboard" : "/onboarding");
        response.cookies.set("royal_session", await createSessionToken(user.id), sessionCookieOptions());
        return response;
      },
    })
  : null;
