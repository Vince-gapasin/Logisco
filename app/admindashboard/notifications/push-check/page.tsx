"use client";

// Why a phone is silent, answered by the deployment serving this page.
//
// Not linked from anywhere: it is opened by address when something is wrong.
// The API behind it needs the signed-in token, which a browser tab typing the
// URL does not send - this page is what carries it.

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";

interface Device {
  employeeID: string;
  name: string;
  role: string;
  platform: string;
  lastSeenAt: string | null;
  dead: boolean;
}

interface Status {
  configured: boolean;
  projectID: string | null;
  credentialOk: boolean;
  detail: string;
  devices: Device[];
}

export default function PushCheckPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState("");
  const [result, setResult] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: Status }>("/api/notifications/push-status", { cache: "no-store" });
      setStatus(response.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not read the push status.");
    }
  }, []);

  useEffect(() => {
    // The status lands in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sendTest = async (device: Device) => {
    setSending(device.employeeID);
    setResult("");
    try {
      const response = await apiFetch<{ data: { message: string } }>("/api/notifications/push-status", {
        method: "POST",
        body: JSON.stringify({ employeeID: device.employeeID }),
      });
      setResult(response.data.message);
    } catch (sendError) {
      setResult(sendError instanceof Error ? sendError.message : "The test could not be sent.");
    } finally {
      setSending("");
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BellRing className="w-6 h-6 text-blue-600" />
          Phone Notifications
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Whether this server can send to phones, and which phones are registered.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {!status && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Asking the server…
        </div>
      )}

      {status && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <div className="flex items-start gap-3">
              {status.credentialOk ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-slate-900">
                  {status.credentialOk ? "This server can send push" : "This server cannot send push"}
                </p>
                <p className="text-sm text-slate-600">{status.detail}</p>
                {status.projectID && (
                  <p className="text-xs text-slate-400 mt-1">Firebase project: {status.projectID}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Registered phones ({status.devices.length})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                A phone appears here once someone signs into the app on it.
              </p>
            </div>

            {status.devices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No phone has registered. The app registers one after signing in, with notifications allowed.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {status.devices.map((device, index) => (
                  <li key={device.employeeID + index} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Smartphone className={`w-4 h-4 mt-0.5 shrink-0 ${device.dead ? "text-slate-300" : "text-slate-500"}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {device.name} <span className="text-xs font-normal text-slate-500">{device.role}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {device.platform}
                          {device.lastSeenAt ? ` · last seen ${new Date(device.lastSeenAt).toLocaleString("en-PH")}` : ""}
                        </p>
                        {device.dead && (
                          <p className="text-xs text-red-600">
                            Firebase says this one is gone - uninstalled, or its token was replaced.
                          </p>
                        )}
                      </div>
                    </div>

                    {!device.dead && (
                      <button
                        onClick={() => void sendTest(device)}
                        disabled={sending === device.employeeID}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        {sending === device.employeeID ? "Sending…" : "Send test"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {result && <p className="px-5 py-3 border-t border-slate-100 text-sm text-slate-700">{result}</p>}
          </div>
        </>
      )}
    </div>
  );
}
