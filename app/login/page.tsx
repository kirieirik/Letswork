"use client";

import { FormEvent, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setMessage("Add your Supabase values to .env.local first.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage(error.message);
    else router.push("/");
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Check size={17} strokeWidth={3} /></span><strong>Company Tasks</strong></div>
        <div className="auth-heading"><span className="eyebrow">Creative Co. workspace</span><h1>Welcome back</h1><p>Sign in to see what the team is working on.</p></div>
        <form onSubmit={submit} className="auth-form">
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
          <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {message && <p className="auth-error" role="alert">{message}</p>}
          <button className="primary-button auth-submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="auth-footnote">Access is managed by your company workspace administrator.</p>
      </section>
    </main>
  );
}
