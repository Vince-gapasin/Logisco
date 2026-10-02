"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/app/lib/supabase-browser";
import { getPasswordPolicyError } from "@/app/lib/passwordPolicy";

const SPECIAL_CHARACTER = /[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~';&+=]/;

function Requirement({ valid, children }: { valid: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          valid ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
        }`}
      >
        {valid ? "✓" : "•"}
      </span>
      <span className={valid ? "text-green-600" : "text-slate-500"}>{children}</span>
    </li>
  );
}

/*
  Page opened from the "forgot password" email. Separate from /set-password,
  which is for first-time activation: this one only changes the password and
  does not touch the employee's activation.

  Accepts every link format Supabase can send:
    #access_token=...&type=recovery   (sent by /api/auth/forgot-password)
    ?code=...                          (PKCE, same browser only)
    ?token_hash=...&type=recovery      (custom email template)
*/
export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const establishRecoverySession = async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.substring(1));
        const query = new URLSearchParams(window.location.search);

        const linkError = hash.get("error_description") ?? query.get("error_description");
        if (linkError) {
          setHasSession(false);
          return;
        }

        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = query.get("code");
        const tokenHash = query.get("token_hash");

        if (accessToken && refreshToken) {
          await supabaseBrowser.auth.signOut({ scope: "local" });
          const { data, error } = await supabaseBrowser.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          setHasSession(!error && !!data.session);
        } else if (tokenHash) {
          const { data, error } = await supabaseBrowser.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          setHasSession(!error && !!data.session);
        } else if (code) {
          const { data, error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          setHasSession(!error && !!data.session);
        } else {
          const { data } = await supabaseBrowser.auth.getSession();
          setHasSession(!!data.session);
        }

        // Keep the one-time tokens out of the address bar and history.
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("Reset link error:", err);
        setHasSession(false);
      } finally {
        setIsCheckingLink(false);
      }
    };

    void establishRecoverySession();
  }, []);

  const requirements = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: SPECIAL_CHARACTER.test(password),
    }),
    [password],
  );

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit =
    hasSession && !isSubmitting && !success && !getPasswordPolicyError(password) && passwordsMatch;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const policyError = getPasswordPolicyError(password);
    if (policyError) return setError(policyError);
    if (!passwordsMatch) return setError("Passwords do not match.");

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({ password });

      if (updateError) {
        setError(
          /different from the old password/i.test(updateError.message)
            ? "Your new password must be different from your current password."
            : updateError.message || "Unable to reset your password. Please try again.",
        );
        return;
      }

      // Sign this temporary session out so they log in with the new password.
      await supabaseBrowser.auth.signOut({ scope: "local" });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("Something went wrong while resetting your password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const shell = (content: React.ReactNode) => (
    <main className="min-h-screen bg-slate-50 px-4 py-10 pt-[calc(2.5rem+var(--safe-top))] pb-[calc(2.5rem+var(--safe-bottom))] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {content}
      </div>
    </main>
  );

  if (isCheckingLink) {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">Checking your reset link</h1>
        <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
      </div>,
    );
  }

  if (!hasSession) {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">Reset link expired</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This password reset link is invalid, expired or has already been used. Request a new
          one from the login page.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
        >
          Back to Login
        </Link>
      </div>,
    );
  }

  return shell(
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reset Your Password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter a new password for your LOGISCO account.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">
            Your password has been reset. Redirecting you to the login page...
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-900">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="Enter your new password"
            autoComplete="new-password"
            disabled={isSubmitting || success}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="mb-3 text-sm font-medium text-slate-900">Password requirements</p>
            <ul className="space-y-2">
              <Requirement valid={requirements.minLength}>At least 8 characters</Requirement>
              <Requirement valid={requirements.uppercase}>At least one uppercase letter</Requirement>
              <Requirement valid={requirements.lowercase}>At least one lowercase letter</Requirement>
              <Requirement valid={requirements.number}>At least one number</Requirement>
              <Requirement valid={requirements.special}>At least one special character</Requirement>
            </ul>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-900">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            disabled={isSubmitting || success}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
          )}
          {passwordsMatch && <p className="mt-2 text-sm text-green-600">✓ Passwords match</p>}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-lg px-4 py-3 font-medium transition ${
            canSubmit
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          }`}
        >
          {isSubmitting ? "Saving..." : "Reset Password"}
        </button>
      </form>
    </>,
  );
}
