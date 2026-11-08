"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { GuideMood } from "@/components/candidate/candidate-guide";
import { useWorkspace } from "@/lib/demo/workspace";
import { isIntakeAvailable } from "@/lib/domain/slots";
import { normalizeCanonicalJobId } from "@/lib/domain/validation";

type ListingAvailability = {
  canonicalJobId: string;
  status: "open" | "closed" | "unknown";
  checkedAt: string | null;
  source: "official" | "unknown";
  reason: string;
};

type JobLookupProps = {
  onGuideUpdate?: (mood: GuideMood, message: string) => void;
};

export function JobLookup({ onGuideUpdate }: JobLookupProps) {
  const router = useRouter();
  const { jobs, slots, mode, loading, error: workspaceError } = useWorkspace();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"error" | "info">("error");
  const [checking, setChecking] = useState(false);

  function showMessage(
    mood: GuideMood,
    copy: string,
    nextTone: "error" | "info",
  ) {
    setTone(nextTone);
    setMessage(copy);
    onGuideUpdate?.(mood, copy);
  }

  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const canonicalJobId = normalizeCanonicalJobId(value);
    if (!canonicalJobId) {
      showMessage(
        "unavailable",
        "Enter an EA job ID or a valid EA Careers listing link.",
        "error",
      );
      return;
    }
    if (checking) return;

    setChecking(true);
    setTone("info");
    setMessage("Checking the listing…");
    onGuideUpdate?.("checking", "I’m checking the current listing.");
    try {
      const response = await fetch("/api/jobs/availability", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canonicalJobId }),
      });
      const result = (await response.json()) as ListingAvailability | null;
      if (
        !response.ok ||
        !result ||
        result.canonicalJobId !== canonicalJobId ||
        !["open", "closed", "unknown"].includes(result.status)
      ) {
        showMessage(
          "unavailable",
          "Requests aren’t available right now. Please try again later.",
          "info",
        );
        return;
      }
      if (result.status === "unknown" || result.source !== "official") {
        showMessage(
          "unavailable",
          "I couldn’t verify this listing. Please try again later.",
          "info",
        );
        return;
      }
      if (result.status === "closed") {
        showMessage(
          "unavailable",
          "This EA Careers listing appears closed. No request was created.",
          "info",
        );
        return;
      }

      if (mode !== "connected" || loading || workspaceError) {
        showMessage(
          "unavailable",
          workspaceError || mode !== "connected"
            ? "Requests aren’t available right now. Please try again later."
            : loading
              ? "I’m still checking the referral service. Please try again shortly."
              : "Requests aren’t available right now. Please try again later.",
          "info",
        );
        return;
      }

      const job = jobs.find((item) => item.canonicalJobId === canonicalJobId);
      if (!job) {
        showMessage(
          "unavailable",
          "The listing is open, but a referral request for it isn’t available here yet.",
          "info",
        );
        return;
      }
      const slot = slots.find((item) => item.jobId === job.id);
      const slotReady =
        slot?.status === "available" && isIntakeAvailable(job, []);
      if (!slotReady) {
        showMessage(
          "unavailable",
          "The listing is open, but a referral slot hasn’t been confirmed.",
          "info",
        );
        return;
      }

      onGuideUpdate?.(
        "success",
        "The listing is open and the referral slot is available. Let’s check the next step.",
      );
      router.push(`/referral/${encodeURIComponent(job.id)}`);
    } catch {
      showMessage(
        "unavailable",
        "I couldn’t verify this listing. Please try again later.",
        "info",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={resolve}
        className="flex flex-col gap-2 sm:flex-row"
        aria-busy={checking}
      >
        <label className="sr-only" htmlFor="job-lookup">
          EA Careers URL or job ID
        </label>
        <input
          id="job-lookup"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-[#cfdae8] bg-white px-4 text-sm text-[#233a58] transition outline-none placeholder:text-[#8797aa] focus:border-[#4981d4] focus:ring-4 focus:ring-[#e8f1ff] sm:rounded-full sm:px-5"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage("");
            if (event.target.value.trim())
              onGuideUpdate?.("thinking", "I’m looking over the role details.");
          }}
          placeholder="EA Careers link or job ID"
          inputMode="url"
        />
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#2456c7] px-6 text-sm font-semibold text-white transition hover:bg-[#1b46aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2456c7] disabled:cursor-wait disabled:opacity-70 sm:rounded-full"
          type="submit"
          disabled={checking}
        >
          {checking && (
            <span
              aria-hidden="true"
              className="size-3 rounded-full border-2 border-white/50 border-t-white motion-safe:animate-spin"
            />
          )}
          {checking ? "Checking…" : "Check role"}
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 rounded-xl px-4 py-3 text-xs leading-5 ${tone === "info" ? "border border-[#d7e8f8] bg-[#f1f8ff] text-[#496681]" : "border border-[#f2d7d0] bg-[#fff6f3] text-[#844936]"}`}
          role="status"
        >
          {message}
        </p>
      )}
      {checking && (
        <span className="sr-only" role="status">
          Checking current listing availability.
        </span>
      )}
    </div>
  );
}
