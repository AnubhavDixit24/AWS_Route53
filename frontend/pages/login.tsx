import { useState, FormEvent } from "react";
import Head from "next/head";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign in - AWS Route 53 Clone</title>
      </Head>
      <div className="login-page">
        <div className="login-logo">
          <span className="login-logo-mark">aws</span>
        </div>
        <div className="login-box">
          <h1>Sign in</h1>
          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="login-hint">
            Demo credentials: <strong>admin</strong> / <strong>admin123</strong>
          </div>
        </div>
        <div className="login-footer">
          © 2026, Amazon Web Services, Inc. or its affiliates. (Clone project — not affiliated with AWS)
        </div>
      </div>
    </>
  );
}