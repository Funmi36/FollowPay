"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e?: React.FormEvent, creds?: { email: string; password: string }) {
    if (e) e.preventDefault();
    setError(null);

    const submitEmail = creds?.email ?? email;
    const submitPassword = creds?.password ?? password;

    if (!submitEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!submitPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: submitEmail,
        password: submitPassword,
        redirect: false,
        redirectTo: callbackUrl,
      });

      if (!res || res.error) {
        setError("Invalid email or password. Please check your credentials.");
        setLoading(false);
      } else {
        // Successful login: navigate to destination
        window.location.href = callbackUrl;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  function handleFillDemo(autoSubmit = false) {
    const demoCreds = {
      email: "demo@followpay.com",
      password: "followpay123",
    };
    setEmail(demoCreds.email);
    setPassword(demoCreds.password);
    setError(null);

    if (autoSubmit) {
      handleLogin(undefined, demoCreds);
    }
  }

  return (
    <div className="login-card">
      <div className="login-brand">
        <span className="logo-icon">🧾</span>
        <h1>PayFollow</h1>
      </div>
      <p className="login-desc">
        Sign in to manage overdue invoices and draft tailored payment follow-ups.
      </p>

      {error && (
        <div className="login-alert" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="demo-box">
        <h3>Demo Account</h3>
        <p>You can sign in with the pre-configured demo credentials or any email with 6+ character password:</p>
        <div className="demo-creds">
          <div><strong>Email:</strong> demo@followpay.com</div>
          <div><strong>Password:</strong> followpay123</div>
        </div>
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr" }}>
          <button
            type="button"
            className="demo-fill-btn"
            onClick={() => handleFillDemo(false)}
            disabled={loading}
          >
            Fill Credentials
          </button>
          <button
            type="button"
            className="demo-fill-btn"
            style={{ fontWeight: 600 }}
            onClick={() => handleFillDemo(true)}
            disabled={loading}
          >
            Instant Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

