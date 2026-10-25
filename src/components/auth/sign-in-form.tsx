"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/status";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${sent ? "verify" : "request"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent ? { email, token: code, next } : { email }),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.message || "Sign in could not be completed.");
      if (!sent) {
        setSent(true);
        setMessage(
          "If this address can sign in, a verification code has been sent.",
        );
      } else {
        router.replace(typeof value.next === "string" ? value.next : "/status");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label
        className="block text-sm font-medium text-[#304d41]"
        htmlFor="signin-email"
      >
        Email address
      </label>
      <input
        id="signin-email"
        className="min-h-12 w-full rounded-xl border border-[#ccd8d1] bg-white px-4"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={sent}
      />
      {sent && (
        <label
          className="block text-sm font-medium text-[#304d41]"
          htmlFor="signin-code"
        >
          Email verification code
          <input
            id="signin-code"
            className="mt-2 min-h-12 w-full rounded-xl border border-[#ccd8d1] bg-white px-4"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      )}
      <button
        className="min-h-12 w-full rounded-full bg-[#173d32] px-5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy
          ? "Please wait…"
          : sent
            ? "Verify and continue"
            : "Send a verification code"}
      </button>
      {sent && (
        <button
          type="button"
          className="text-sm font-semibold text-[#315b4c] underline"
          onClick={() => {
            setSent(false);
            setCode("");
            setMessage("");
          }}
        >
          Use a different email
        </button>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-[#dce3dd] bg-[#f5f7f4] px-4 py-3 text-sm leading-6 text-[#52645d]"
        >
          {message}
        </p>
      )}
      <p className="text-xs leading-5 text-[#77857e]">
        No password is needed. Code delivery depends on the configured Supabase
        Auth email settings; no separate email provider is configured by this
        app.
      </p>
    </form>
  );
}
