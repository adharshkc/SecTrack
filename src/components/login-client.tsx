"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "./ui/primitives";

export function LoginClient({
  vaultInitialized,
  storageProvider,
  legacySha256CompatEnabled,
}: {
  vaultInitialized: boolean;
  storageProvider: string;
  legacySha256CompatEnabled: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacyWarning, setLegacyWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Invalid password.");
      }
      if (data.usedLegacySha256) {
        setLegacyWarning(true);
      }

      setPassword("");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070b14] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            SecTrack<span className="text-emerald-400">.io</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Private Single-User Cybersecurity Learning Tracker
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0e1525] p-7 shadow-2xl">
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Password Sign In
              </h2>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-400">
                {storageProvider}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {vaultInitialized
                ? "Enter your password to unlock your learning roadmap, study logs, and analytics."
                : "Password login is not configured. Set APP_PASSWORD_HASH and APP_SESSION_SECRET on the server."}
            </p>
          </div>

          {legacySha256CompatEnabled || legacyWarning ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Legacy SHA-256 compatibility mode is active. Generate an{" "}
                <code className="font-mono">scrypt$</code> hash in Settings and
                replace <code className="font-mono">APP_PASSWORD_HASH</code>.
              </span>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !vaultInitialized}
            >
              {loading ? "Verifying..." : "Unlock Tracker"}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
            Protected by HttpOnly session cookies, CSRF validation &amp; scrypt KDF.
            <br />
            Primary Curriculum:{" "}
            <a
              href="https://www.itshahirx.com/roadmap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              itshahirx.com/roadmap
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
