"use client";

// What this deployment can and cannot do.
//
// Opened by address when something is quietly not happening: a phone that
// stays silent, a tracking email nobody received, a forecast that has not
// moved in a month. Everything here is best-effort by design and therefore
// says nothing when it fails, which is why this page exists.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Smartphone, XCircle } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";

interface Check {
  area: string;
  name: string;
  state: "ok" | "warning" | "failed";
  detail: string;
  setting?: string;
}

const icons = {
  ok: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  failed: <XCircle className="w-5 h-5 text-red-600" />,
};

export default function SystemHealthPage() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: { checks: Check[] } }>("/api/system-health", { cache: "no-store" });
      setChecks(response.data.checks);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not read the system status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The result lands in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const areas = [...new Set((checks ?? []).map((check) => check.area))];
  const broken = (checks ?? []).filter((check) => check.state === "failed").length;

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
          <p className="text-slate-600 text-sm mt-1">
            What this deployment can reach, and what it cannot. Everything below fails quietly by design.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Check again
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {!checks && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Asking the server…
        </div>
      )}

      {checks && broken > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
          {broken === 1 ? "One thing is not working" : `${broken} things are not working`}. Each names the setting it
          needs; they are set per deployment, so a value present locally may be missing here.
        </div>
      )}

      {areas.map((area) => (
        <div key={area} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">{area}</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {(checks ?? [])
              .filter((check) => check.area === area)
              .map((check) => (
                <li key={check.name} className="px-5 py-4 flex items-start gap-3">
                  <span className="shrink-0 mt-0.5">{icons[check.state]}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{check.name}</p>
                    <p className="text-sm text-slate-600">{check.detail}</p>
                    {check.setting && (
                      <p className="text-xs text-slate-400 mt-1">
                        Set <span className="font-mono">{check.setting}</span> on the deployment, then redeploy.
                      </p>
                    )}
                  </div>
                </li>
              ))}
        </ul>
        </div>
      ))}

      <Link
        href="/admindashboard/notifications/push-check"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <Smartphone className="w-4 h-4" />
        Registered phones, and sending a test to one
      </Link>
    </div>
  );
}
