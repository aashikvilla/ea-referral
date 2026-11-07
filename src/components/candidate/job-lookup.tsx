"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/demo/workspace";
import { normalizeCanonicalJobId } from "@/lib/domain/validation";

export function JobLookup() {
  const router = useRouter();
  const { jobs } = useWorkspace();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"error" | "info">("error");

  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const raw = value.trim();
    if (!raw) {
      setMessage("Paste an EA Careers link or enter a job ID.");
      return;
    }
    const internal = jobs.find((job) => job.id === raw);
    const canonicalJobId = normalizeCanonicalJobId(raw);
    const job =
      internal ?? jobs.find((item) => item.canonicalJobId === canonicalJobId);
    if (!job) {
      setTone("info");
      setMessage(
        canonicalJobId
          ? "This job ID isn’t included in the browser demo. Live EA job lookup is not connected, so no role status or availability is being claimed."
          : "I couldn’t validate that EA Careers link or job ID. Use a supported EA job link or a numeric job ID.",
      );
      return;
    }
    setTone("error");
    router.push(`/referral/${encodeURIComponent(job.id)}`);
  }

  return (
    <div>
      <form onSubmit={resolve} className="flex flex-col gap-2 sm:flex-row">
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
          }}
          placeholder="Paste an EA Careers link or job ID"
          inputMode="url"
        />
        <button
          className="min-h-12 rounded-2xl bg-[#2456c7] px-6 text-sm font-semibold text-white transition hover:bg-[#1b46aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2456c7] sm:rounded-full"
          type="submit"
        >
          Check role <span aria-hidden="true">→</span>
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
    </div>
  );
}
