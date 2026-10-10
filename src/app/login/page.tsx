import Link from "next/link";
import { KeyRound } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { isAuth0Configured } from "@/lib/auth0";

const errorMessages: Record<string, string> = {
  credentials: "Email or password is incorrect.",
  exists: "An account already exists for this email.",
  database: "Sign-up is temporarily unavailable. Check the business database setup, then try again.",
  auth0: "Auth0 sign-in could not be completed. Please try again.",
  "auth0-email": "Verify your email with your identity provider before signing in.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const { error, mode } = await searchParams;
  const signup = mode === "signup";
  const minPasswordLength = signup ? 10 : process.env.DEMO_MODE === "true" ? 3 : 8;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand" style={{ padding: 0, color: "#176b55" }}>ROYAL’S AI<small style={{ color: "#82918c" }}>BUSINESSOS</small></div>
        <h1 style={{ fontSize: 25, letterSpacing: -.8, margin: "28px 0 7px" }}>{signup ? "Create your workspace" : "Welcome back"}</h1>
        <p className="sub" style={{ marginBottom: 25 }}>{signup ? "Start bringing your business together." : "Sign in to your business workspace."}</p>

        {error && <div className="alert">{errorMessages[error] ?? "Please check your details and try again."}</div>}

        <form action={signup ? signUp : signIn}>
          {signup && <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" required minLength={2} /></div>}
          <div className="field"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={minPasswordLength} /></div>
          <button className="btn" style={{ width: "100%" }}>{signup ? "Create account" : "Sign in"}</button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "#99a39f", fontSize: 10 }}>
          <span style={{ height: 1, flex: 1, background: "#e7eceb" }} />OR<span style={{ height: 1, flex: 1, background: "#e7eceb" }} />
        </div>
        {isAuth0Configured ? (
          <a href={signup ? "/auth/login?screen_hint=signup" : "/auth/login"} className="btn secondary" style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <KeyRound size={15} />Continue with Auth0
          </a>
        ) : (
          <p className="section-sub" style={{ textAlign: "center", margin: 0 }}>Auth0 sign-in is ready to enable. Add the Auth0 settings to your server environment.</p>
        )}

        <p style={{ fontSize: 12, color: "#718087", textAlign: "center", marginTop: 20 }}>
          {signup ? "Already have an account? " : "New to BusinessOS? "}
          <Link href={signup ? "/login" : "/login?mode=signup"} style={{ color: "#176b55", fontWeight: 700 }}>{signup ? "Sign in" : "Create account"}</Link>
        </p>
        <p style={{ fontSize: 10, color: "#99a39f", textAlign: "center", marginTop: 24 }}>ROYAL’S AI PRIVATE LIMITED · A FUTURE MAKERS TECHNOLOGIES company</p>
      </section>
    </main>
  );
}
