import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { adminBasePath, joinAdminPath } from "../config";

import { LoginVisual } from "../components/LoginVisual";
import panelMark from "../assets/paneljs-mark.svg";

type Identifier = "email" | "username";

const authUrl = joinAdminPath(adminBasePath, "/api/auth");

export const LoginPage = () => {
  const [identifierType, setIdentifierType] = useState<Identifier | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${authUrl}/config`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Built-in admin authentication is unavailable.");
        return response.json() as Promise<{ identifier: Identifier }>;
      })
      .then((config) => active && setIdentifierType(config.identifier))
      .catch(
        (reason: unknown) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load the sign-in form.",
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifierType || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${authUrl}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to sign in.");
      }
      window.location.assign(joinAdminPath(adminBasePath, "/"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const identifierLabel =
    identifierType === "email" ? "Email address" : "Username";
  return (
    <main className="login-page" aria-labelledby="login-title">
      <LoginVisual />
      <div className="login-form-panel">
        <div className="login-panel-label">
          <span>PanelJS</span>
          <span>Admin workspace</span>
        </div>
        <section className="login-card">
          <img
            className="login-brand"
            src={panelMark}
            alt="PanelJS"
            width="40"
            height="40"
          />
          <div className="login-heading">
            <h1 id="login-title">Welcome back.</h1>
            <span>Sign in to your admin workspace.</span>
          </div>

          <form className="login-form" onSubmit={submit} aria-busy={submitting}>
            <div className="login-field">
              <label htmlFor="admin-identifier">{identifierLabel}</label>
              <input
                id="admin-identifier"
                name="identifier"
                type={identifierType === "email" ? "email" : "text"}
                autoComplete="username"
                placeholder={
                  identifierType === "email"
                    ? "you@company.com"
                    : "Your username"
                }
                autoCapitalize="none"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={!identifierType || submitting}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="admin-password">Password</label>
              <div className="login-password-wrap">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!identifierType || submitting}
                  required
                />
                <button
                  className="password-visibility"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={!identifierType || submitting}
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.75} />
                  ) : (
                    <Eye size={18} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="login-submit"
              type="submit"
              disabled={!identifierType || submitting}
            >
              <span>{submitting ? "Signing in…" : "Sign in"}</span>
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
          <p className="login-access-note">
            Need access? Contact your administrator.
          </p>
        </section>
        <p className="login-footer">
          <LockKeyhole size={13} strokeWidth={1.75} aria-hidden="true" />{" "}
          Administrator access only
        </p>
      </div>
    </main>
  );
};
