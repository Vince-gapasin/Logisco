// ==========================================
// LOGISCO - CLEAN LOGIN PAGE COMPONENT
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { authenticateUser } from "@/services/authService";
// If you have a shared supabase client, you can import it here:
// import { supabase } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "forgot">("email");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Check for auto-login / existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("logisco_user_session");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.route) {
          router.push(user.route);
        }
      } catch (e) {
        localStorage.removeItem("logisco_user_session");
      }
    }
  }, [router]);

  // Handle clicking "Next" after entering the email/username
  const handleEmailNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email or username.");
      return;
    }

    // Move to the password step
    setStep("password");
  };

  // Handle final login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const user = await authenticateUser(email, password);
      setIsLoading(false);

      if (user) {
        // 1. Intercept and determine the correct route based on database role
        let targetRoute = "/";
        const role = user.role ? user.role.toLowerCase() : "";

        if (role === "admin") {
          targetRoute = "/admindashboard/dashboard";
        } else if (role === "coordinator") {
          targetRoute = "/coordinator";
        } else if (role === "driver") {
          targetRoute = "/driver";
        } else if (role === "mechanic") {
          targetRoute = "/mechanic";
        } else if (role === "helper") {
          targetRoute = "/helper";
        } else {
          // Fallback if role is missing, we check if the email has admin
          targetRoute = email.includes("admin")
            ? "/admindashboard/dashboard"
            : "/dashboard";
        }

        // 2. Update the user object with the correct route before saving the session
        const updatedUser = { ...user, route: targetRoute };

        // 3. Save session if Auto-login / Remember Me is checked
        if (rememberMe) {
          localStorage.setItem(
            "logisco_user_session",
            JSON.stringify(updatedUser),
          );
        } else {
          sessionStorage.setItem(
            "logisco_user_session",
            JSON.stringify(updatedUser),
          );
        }

        // 4. Send them to their specific dashboard!
        router.push(targetRoute);
      } else {
        setError("Invalid email or password credentials.");
      }
    } catch (err) {
      setIsLoading(false);
      setError("An unexpected authentication error occurred.");
    }
  };

  // Handle password reset request submission (Supabase Ready)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSuccess(false);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      // --- SUPABASE PASSWORD RESET INTEGRATION ---
      // When your Supabase client is connected, uncomment the lines below:
      /*
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      */

      // Simulating network delay for backend readiness demonstration without fake credentials
      await new Promise((resolve) => setTimeout(resolve, 800));

      setIsLoading(false);
      setResetSuccess(true);
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || "Failed to send password reset request.");
    }
  };

  return (
    <div className="min-h-screen bg-[#000517] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background ambient glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md bg-[#000c31] border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-600/10 border border-blue-500/20 rounded-2xl text-white mb-3 shadow-inner">
            <Truck size={36} className="text-blue-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f0f4ff] tracking-tight">
            LOGISCO
          </h1>
          <p className="text-sm text-[#8ba4d5] mt-1">
            JO Paterno Trucking Services Portal
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification for Forgot Password */}
        {resetSuccess && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>
              If an account matches this email, a password reset link has been
              sent. Please check your inbox.
            </span>
          </div>
        )}

        {/* Step 1: Email / Username Form */}
        {step === "email" && (
          <form onSubmit={handleEmailNext} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#f4f4fa] mb-1.5">
                Email Address / Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8ba4d5]">
                  <Mail size={18} />
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  autoFocus
                  className="w-full bg-[#000517] border border-slate-800 text-[#f0f4ff] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-3 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200 text-sm cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* Step 2: Password Form */}
        {step === "password" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center justify-between bg-[#000517] border border-slate-800/80 px-3.5 py-2 rounded-xl mb-2">
              <span className="text-xs text-[#8ba4d5] truncate max-w-65">
                Signing in as: <strong className="text-white">{email}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setPassword("");
                  setError("");
                }}
                className="text-xs text-blue-400 hover:underline shrink-0"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#eef0f3] mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8ba4d5]">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full bg-[#000517] border border-slate-800 text-[#f0f4ff] rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8ba4d5] hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Link */}
            <div className="flex items-center justify-between text-xs text-[#8ba4d5] pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#000517] border-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                />
                <span>Keep me logged in</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("forgot");
                  setError("");
                  setResetSuccess(false);
                }}
                className="text-blue-400 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="px-4 py-3 rounded-xl border border-slate-800 text-[#8ba4d5] hover:text-white hover:bg-slate-800/50 transition text-sm flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Forgot Password Form */}
        {step === "forgot" && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#f0f4ff] mb-1">
                Reset Your Password
              </h2>
              <p className="text-xs text-[#8ba4d5] mb-4">
                Enter your account email address and we will send you a secure
                link to reset your password.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#f4f4fa] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8ba4d5]">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  autoFocus
                  className="w-full bg-[#000517] border border-slate-800 text-[#f0f4ff] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setError("");
                  setResetSuccess(false);
                }}
                className="px-4 py-3 rounded-xl border border-slate-800 text-[#8ba4d5] hover:text-white hover:bg-slate-800/50 transition text-sm flex items-center justify-center cursor-pointer"
                title="Back to Login"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer Help text */}
        <div className="mt-5 text-center text-xs text-[#8ba4d5]/60 border-t border-slate-800/60 pt-4">
          Protected logistics gateway • JO Paterno
        </div>
      </div>
    </div>
  );
}
