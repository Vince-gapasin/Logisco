"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/app/lib/supabase-browser";

export default function SetPasswordPage() {
  const router = useRouter();

  // ==========================================
  // STATE
  // ==========================================

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [passwordTouched, setPasswordTouched] =
    useState(false);

  const [
    confirmPasswordTouched,
    setConfirmPasswordTouched,
  ] = useState(false);

  const [isCheckingSession, setIsCheckingSession] =
    useState(true);

  const [hasSession, setHasSession] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  // ==========================================
  // PASSWORD VALIDATION
  // ==========================================

  const passwordRequirements = useMemo(
    () => ({
      minLength:
        password.length >= 8,

      uppercase:
        /[A-Z]/.test(password),

      lowercase:
        /[a-z]/.test(password),

      number:
        /[0-9]/.test(password),

      special:
        /[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~';&+<=>]/.test(
          password
        ),
    }),
    [password]
  );

  const isPasswordValid =
    passwordRequirements.minLength &&
    passwordRequirements.uppercase &&
    passwordRequirements.lowercase &&
    passwordRequirements.number &&
    passwordRequirements.special;

  const isConfirmPasswordValid =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const isFormValid =
    isPasswordValid &&
    isConfirmPasswordValid;

  // ==========================================
  // INITIALIZE INVITATION SESSION
  // ==========================================

  useEffect(() => {
  const initializeInvitationSession = async () => {
    try {
      // ======================================
      // 1. CHECK FOR INVITATION TOKENS FIRST
      // ======================================

      const hash = window.location.hash;

      if (hash) {
        const params = new URLSearchParams(
          hash.substring(1)
        );

        const accessToken =
          params.get("access_token");

        const refreshToken =
          params.get("refresh_token");

        const type =
          params.get("type");

        // ====================================
        // 2. VALIDATE INVITATION
        // ====================================

        if (
          type === "invite" &&
          accessToken &&
          refreshToken
        ) {
          console.log(
            "Invitation tokens found. Clearing any old session..."
          );

          // ----------------------------------
          // CLEAR ANY STALE LOCAL SESSION
          // ----------------------------------

          await supabaseBrowser.auth.signOut({
            scope: "local",
          });

          // ----------------------------------
          // ESTABLISH NEW INVITATION SESSION
          // ----------------------------------

          const {
            data,
            error,
          } =
            await supabaseBrowser.auth.setSession({
              access_token:
                accessToken,

              refresh_token:
                refreshToken,
            });

          if (error) {
            console.error(
              "Failed to establish invitation session:",
              error
            );

            setHasSession(false);

            return;
          }

          if (!data.session) {
            console.warn(
              "Supabase did not return an invitation session"
            );

            setHasSession(false);

            return;
          }

          console.log(
            "New invitation session established successfully"
          );

          // ----------------------------------
          // REMOVE TOKENS FROM URL
          // ----------------------------------

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          setHasSession(true);

          return;
        }
      }

      // ======================================
      // 3. NO INVITATION TOKEN
      // ======================================
      // If the page was refreshed after the
      // invitation hash was removed, use the
      // existing valid session.

      const {
        data: {
          session,
        },
      } =
        await supabaseBrowser.auth.getSession();

      if (session) {
        console.log(
          "Existing valid session found"
        );

        setHasSession(true);

        return;
      }

      // ======================================
      // 4. NO VALID SESSION
      // ======================================

      console.warn(
        "No valid invitation session found"
      );

      setHasSession(false);

    } catch (error) {
      console.error(
        "Invitation initialization error:",
        error
      );

      setHasSession(false);

    } finally {
      setIsCheckingSession(false);
    }
  };

  initializeInvitationSession();
}, []);

  // ==========================================
  // SUBMIT PASSWORD
  // ==========================================

// ==========================================
// SUBMIT PASSWORD
// ==========================================

const handleSubmit = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  setPasswordTouched(true);
  setConfirmPasswordTouched(true);

  setSubmitError("");
  setSuccessMessage("");

  // ==========================================
  // 1. VALIDATE PASSWORD
  // ==========================================

  if (!isPasswordValid) {
    setSubmitError(
      "Please meet all password requirements."
    );

    return;
  }

  if (!isConfirmPasswordValid) {
    setSubmitError(
      "Passwords do not match."
    );

    return;
  }

  // ==========================================
  // 2. CHECK SUPABASE SESSION
  // ==========================================

  if (!hasSession) {
    setSubmitError(
      "Your activation link is invalid or has expired. Please request a new activation email."
    );

    return;
  }

  try {
    setIsSubmitting(true);

    // ========================================
    // 3. GET CURRENT INVITATION SESSION
    // ========================================

    const {
      data: {
        session,
      },
    } =
      await supabaseBrowser.auth.getSession();

    console.log(
      "TEST ACCESS TOKEN:",
        session?.access_token
      );

    if (!session?.access_token) {
      setSubmitError(
        "Your activation session has expired. Please request a new activation email."
      );

      return;
    }

    // ========================================
    // 4. UPDATE SUPABASE AUTH PASSWORD
    // ========================================

    const {
      error: passwordError,
    } =
      await supabaseBrowser.auth.updateUser({
        password,
      });

    if (passwordError) {
      console.error(
        "Password update error:",
        passwordError
      );

      setSubmitError(
        passwordError.message ||
          "Unable to set your password. Please try again."
      );

      return;
    }

    // ========================================
    // 5. COMPLETE EMPLOYEE ACTIVATION
    // ========================================

    const response =
      await fetch(
        "/api/employees/activate/complete",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

    // ========================================
    // 6. HANDLE API RESPONSE
    // ========================================

    let result: {
      message?: string;
      data?: unknown;
    } = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      console.error(
        "Employee activation error:",
        result
      );

      setSubmitError(
        result.message ||
          "Your password was saved, but your employee account could not be activated."
      );

      return;
    }

    // ========================================
    // 7. SUCCESS
    // ========================================

    setSuccessMessage(
      "Your account has been activated successfully."
    );

    // ========================================
    // 8. REDIRECT TO LOGIN
    // ========================================

    setTimeout(() => {
      router.push("/login");
    }, 1500);

  } catch (error) {
    console.error(
      "Set password error:",
      error
    );

    setSubmitError(
      "Something went wrong while setting your password. Please try again."
    );

  } finally {
    setIsSubmitting(false);
  }
};

  // ==========================================
  // PASSWORD REQUIREMENT COMPONENT
  // ==========================================

  const Requirement = ({
    valid,
    children,
  }: {
    valid: boolean;
    children: React.ReactNode;
  }) => {
    return (
      <li className="flex items-center gap-2 text-sm">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
            valid
              ? "bg-green-100 text-green-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {valid ? "✓" : "•"}
        </span>

        <span
          className={
            valid
              ? "text-green-600"
              : "text-slate-500"
          }
        >
          {children}
        </span>
      </li>
    );
  };

  // ==========================================
  // SESSION CHECKING SCREEN
  // ==========================================

  if (isCheckingSession) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Verifying Invitation
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Please wait while we verify your activation link.
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          {/* HEADER */}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">
              Set Your Password
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a password to activate your LOGISCO account.
            </p>
          </div>

          {/* ERROR */}

          {submitError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                {submitError}
              </p>
            </div>
          )}

          {/* SUCCESS */}

          {successMessage && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm text-green-700">
                {successMessage}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-900"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );

                  setSubmitError("");
                }}
                onBlur={() =>
                  setPasswordTouched(true)
                }
                placeholder="Enter your password"
                autoComplete="new-password"
                disabled={isSubmitting}
                className={`w-full rounded-lg border px-4 py-3 text-slate-900 outline-none transition ${
                  passwordTouched &&
                  !isPasswordValid
                    ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
              />

              {/* REQUIREMENTS */}

              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="mb-3 text-sm font-medium text-slate-900">
                  Password requirements
                </p>

                <ul className="space-y-2">

                  <Requirement
                    valid={
                      passwordRequirements.minLength
                    }
                  >
                    At least 8 characters
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRequirements.uppercase
                    }
                  >
                    At least one uppercase letter
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRequirements.lowercase
                    }
                  >
                    At least one lowercase letter
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRequirements.number
                    }
                  >
                    At least one number
                  </Requirement>

                  <Requirement
                    valid={
                      passwordRequirements.special
                    }
                  >
                    At least one special character
                  </Requirement>

                </ul>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-slate-900"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(
                    event.target.value
                  );

                  setSubmitError("");
                }}
                onBlur={() =>
                  setConfirmPasswordTouched(
                    true
                  )
                }
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={isSubmitting}
                className={`w-full rounded-lg border px-4 py-3 text-slate-900 outline-none transition ${
                  confirmPasswordTouched &&
                  !isConfirmPasswordValid
                    ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
              />

              {/* EMPTY */}

              {confirmPasswordTouched &&
                !confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">
                    Please confirm your password.
                  </p>
                )}

              {/* MISMATCH */}

              {confirmPasswordTouched &&
                confirmPassword &&
                !isConfirmPasswordValid && (
                  <p className="mt-2 text-sm text-red-600">
                    Passwords do not match.
                  </p>
                )}

              {/* MATCH */}

              {isConfirmPasswordValid && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ Passwords match
                </p>
              )}
            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={
                !isFormValid ||
                isSubmitting ||
                !hasSession ||
                !!successMessage
              }
              className={`w-full rounded-lg px-4 py-3 font-medium transition ${
                isFormValid &&
                !isSubmitting &&
                hasSession &&
                !successMessage
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              {isSubmitting
                ? "Activating Account..."
                : "Set Password"}
            </button>

          </form>
        </div>
      </div>
    </main>
  );
}