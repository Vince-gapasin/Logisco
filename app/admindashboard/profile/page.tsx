"use client";

import React, { useState, useEffect } from "react";
import { Mail, Lock, X, AlertCircle, User, Shield } from "lucide-react";

// ==========================================
// SESSION & API FETCH
// ==========================================
const SESSION_KEY = "logisco_user_session";

function getAuthSession() {
  const savedSession = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!savedSession) throw new Error("Authentication session not found. Please log in again.");
  return JSON.parse(savedSession);
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getAuthSession();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.message || `Request failed with status ${response.status}`;
    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
    throw new Error(message);
  }

  return result as T;
}

// ==========================================
// MAIN PAGE
// ==========================================
export default function ProfilePage() {
  // Session state
  const [userInfo, setUserInfo] = useState({
    name: "Loading...",
    email: "Loading...",
    role: "Loading...",
  });

  // Modal states
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Form states
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Fetch session data on mount
  useEffect(() => {
    const sessionData =
      localStorage.getItem("logisco_user_session") ||
      sessionStorage.getItem("logisco_user_session");

    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        setUserInfo({
          name: parsed.employeeName || "Unknown User",
          email: parsed.email || "No email provided",
          role: parsed.role || "Unassigned",
        });
      } catch (error) {
        console.error("Failed to parse session", error);
      }
    }
  }, []);

  // Handle Email Update Submission
  // Handle Email Update Submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!currentEmail || !newEmail || !confirmEmail) {
      setEmailError("All fields are required.");
      return;
    }

    if (newEmail !== confirmEmail) {
      setEmailError("New email addresses do not match.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/update-email", {
        method: "POST",
        body: JSON.stringify({ newEmail }),
      });

      alert(response.message);
      
      // Update the local session storage so the UI updates instantly
      const sessionData = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        parsed.email = newEmail;
        
        if (localStorage.getItem(SESSION_KEY)) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        }
        if (sessionStorage.getItem(SESSION_KEY)) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        }
        
        setUserInfo((prev) => ({ ...prev, email: newEmail }));
      }

      setIsEmailModalOpen(false);
      setCurrentEmail("");
      setNewEmail("");
      setConfirmEmail("");
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  // Handle Password Update Submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/update-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });

      alert(response.message);
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Manage your account credentials, security settings, and profile info.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Change Email</span>
          </button>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* ================= PROFILE CONTENT CARD ================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-100">
        {/* User Identity Section */}
        <div className="p-5 sm:p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border-2 border-slate-100 shadow-inner shrink-0">
            <User className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight uppercase">
              {userInfo.name}
            </h2>
          </div>
        </div>

        {/* Basic Information Section Container */}
        <div className="p-5 sm:p-6 md:p-8 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Shield className="w-4 h-4 text-blue-600" />
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Logged In As
              </label>
              <input
                type="text"
                readOnly
                value={userInfo.email}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none"
              />
              <p className="text-xs text-slate-700 mt-1">
                Populated dynamically from Supabase Auth session.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Role
              </label>
              <input
                type="text"
                readOnly
                value={userInfo.role.toUpperCase()}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none"
              />
              <p className="text-xs text-slate-700 mt-1">
                Fetched from authenticated user profile records.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= CHANGE EMAIL MODAL ================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Change Email Address
              </h3>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                disabled={isSubmittingEmail}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="p-6 space-y-4">
              {emailError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{emailError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  Current Email
                </label>
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  placeholder="Enter current email"
                  disabled={isSubmittingEmail}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  New Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                  disabled={isSubmittingEmail}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  Confirm New Email
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirm new email"
                  disabled={isSubmittingEmail}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  disabled={isSubmittingEmail}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmail}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {isSubmittingEmail ? "Updating..." : "Update Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CHANGE PASSWORD MODAL ================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-700" />
                Change Password
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                disabled={isSubmittingPassword}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={isSubmittingPassword}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  disabled={isSubmittingPassword}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isSubmittingPassword}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-700 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isSubmittingPassword}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                >
                  {isSubmittingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}