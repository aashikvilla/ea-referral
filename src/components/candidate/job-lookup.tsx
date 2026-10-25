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
          className="min-h-12 min-w-0 flex-1 rounded-full border border-[#d4ded7] bg-white px-5 text-sm text-[#304d41] transition outline-none placeholder:text-[#929f98] focus:border-[#4e7f6b] focus:ring-4 focus:ring-[#e5efe8]"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage("");
          }}
          placeholder="Paste an EA Careers link or job ID"
          inputMode="url"
        />
        <button
          className="min-h-12 rounded-full bg-[#173d32] px-6 text-sm font-semibold text-white transition hover:bg-[#245445] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173d32]"
          type="submit"
        >
          Check role <span aria-hidden="true">→</span>
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 rounded-xl px-4 py-3 text-xs leading-5 ${tone === "info" ? "bg-[#f0f3ed] text-[#586a60]" : "bg-[#fcf1ed] text-[#844936]"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
