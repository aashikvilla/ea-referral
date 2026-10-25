"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useWorkspace } from "@/lib/demo/workspace";
import type {
  Application,
  ApplicationStatus,
  CreateJobInput,
  Job,
  UpdateJobInput,
} from "@/lib/demo/types";
import { checkEligibility } from "@/lib/domain/eligibility";
import { isIntakeAvailable } from "@/lib/domain/slots";
import type { AssessmentResult } from "@/server/assessment";

const card =
  "rounded-2xl border border-[#dce5df] bg-white shadow-[0_3px_12px_rgba(24,56,47,0.035)]";
const button =
  "inline-flex items-center justify-center rounded-xl bg-[#1c5545] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174738] disabled:cursor-not-allowed disabled:opacity-45";
const secondary =
  "inline-flex items-center justify-center rounded-xl border border-[#d5e0da] bg-white px-4 py-2.5 text-sm font-semibold text-[#28473c] transition hover:bg-[#f4f8f5]";
const input =
  "w-full rounded-xl border border-[#d6e1da] bg-white px-3.5 py-2.5 text-sm text-[#23382f] outline-none placeholder:text-[#91a097] focus:border-[#568b73] focus:ring-2 focus:ring-[#d8ebe0]";

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relationshipLabel(value: string) {
  const labels: Record<string, string> = {
    current_ea_employee: "Current EA employee",
    customer_client: "Customer / client",
    family_member: "Family member",
    former_colleague: "Former colleague",
    friend: "Friend",
    professional_network: "Professional network",
    other: "Other",
  };
  return labels[value] ?? titleCase(value);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Not verified";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function StatusPill({
  value,
  tone,
}: {
  value: string;
  tone?: "green" | "amber" | "gray" | "red";
}) {
  const colors = {
    green: "bg-[#e7f3eb] text-[#326b4d]",
    amber: "bg-[#fbf1dc] text-[#87622a]",
    gray: "bg-[#edf1ef] text-[#5e6e65]",
    red: "bg-[#fae9e5] text-[#984b3e]",
  };
  const inferred =
    tone ??
    (/(confirmed|open|ready|shortlisted)/i.test(value)
      ? "green"
      : /(unknown|review|pending|reserved|correction)/i.test(value)
        ? "amber"
        : "gray");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${colors[inferred]}`}
    >
      {titleCase(value)}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.17em] text-[#648274] uppercase">
      {children}
    </p>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#18382f] sm:text-[2.15rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7b73]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-xs font-medium text-[#6c7d74]">{label}</p>
      <p
        className={`mt-3 text-3xl font-semibold tracking-tight ${accent ? "text-[#227454]" : "text-[#193b31]"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[#87938c]">{note}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${card} ${className}`}>
      <div className="flex items-center justify-between border-b border-[#edf1ee] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#234338]">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#cbd9d1] bg-[#f9fbf9] px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[#29473c]">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#74827a]">
        {text}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Notice({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${warning ? "border-[#eadbb8] bg-[#fcf6e9] text-[#785f32]" : "border-[#d5e6db] bg-[#eff7f1] text-[#426a53]"}`}
    >
      {children}
    </div>
  );
}

function PrivateFileDownload({ fileId }: { fileId?: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  if (!fileId)
    return (
      <p className="mt-3 text-xs text-[#87938c]">
        No downloadable private file is linked to this record.
      </p>
    );
  const safeFileId = fileId;

  async function download() {
    setLoading(true);
    setMessage("");
    const fileWindow = window.open("about:blank", "_blank");
    try {
      const response = await fetch(
        `/api/files/${encodeURIComponent(safeFileId)}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("url" in body) ||
        typeof body.url !== "string"
      ) {
        throw new Error(
          "The file is unavailable or has not passed its access checks.",
        );
      }
      const downloadUrl = new URL(body.url);
      if (downloadUrl.protocol !== "https:")
        throw new Error("The private file link is invalid.");
      if (fileWindow) fileWindow.location.replace(downloadUrl.href);
      else window.location.assign(downloadUrl.href);
    } catch (error) {
      fileWindow?.close();
      setMessage(
        error instanceof Error
          ? error.message
          : "The file could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className={secondary}
        disabled={loading}
        onClick={download}
      >
        {loading ? "Checking file…" : "Open private file"}
      </button>
      {message && (
        <p className="mt-2 text-xs text-[#984b3e]" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

function AppRow({
  app,
  candidate,
  job,
}: {
  app: Application;
  candidate:
    | {
        firstName: string;
        lastName: string;
        currentTitle: string;
        currentCompany: string;
      }
    | undefined;
  job?: Job;
}) {
  if (!candidate) return null;
  return (
    <tr className="border-t border-[#edf1ee] hover:bg-[#f9fbf9]">
      <td className="px-4 py-3.5">
        <Link
          href={`/admin/candidates/${app.id}`}
          className="font-semibold text-[#244b3d] hover:underline"
        >
          {candidate.firstName} {candidate.lastName}
        </Link>
        <div className="mt-1 text-xs text-[#829087]">
          {candidate.currentTitle} · {candidate.currentCompany}
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-[#617269]">
        {job?.title ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        <span className="font-semibold text-[#315d49]">{app.matchScore}%</span>
      </td>
      <td className="px-4 py-3.5">
        <StatusPill value={app.status} />
      </td>
      <td className="px-4 py-3.5">
        <StatusPill
          value={app.resumeReady ? "Resume ready" : "Needs correction"}
          tone={app.resumeReady ? "green" : "amber"}
        />
      </td>
    </tr>
  );
}

function Dashboard() {
  const { jobs, candidates, applications, activity, mode, funnelMetrics } =
    useWorkspace();
  const pending = applications.filter(
    (a) =>
      !["referral_confirmed", "not_selected", "slot_filled_other"].includes(
        a.status,
      ),
  );
  const actionNeeded = applications.filter(
    (a) =>
      a.status === "correction_required" || a.status === "eligibility_review",
  );
  const referred = applications.filter(
    (a) => a.status === "referral_confirmed",
  );
  const topApps = [...applications]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
  return (
    <>
      <PageTitle
        eyebrow="Owner workspace · Overview"
        title="A clearer view of every request."
        description={
          mode === "demo"
            ? "A sample workspace to review referral requests, check job availability, and prepare a careful manual referral."
            : "Review current referral requests, check job availability, and prepare careful manual referrals."
        }
        action={
          <Link href="/admin/jobs/new" className={button}>
            ＋ Add a job
          </Link>
        }
      />
      {mode === "demo" ? (
        <Notice>
          Demo workspace with fictional records. This screen does not represent
          a real authenticated admin account.
        </Notice>
      ) : (
        <Notice>
          Connected owner workspace. Email sending is unavailable.
        </Notice>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Verified role visits"
          value={mode === "demo" ? "126" : funnelMetrics.verifiedRoleVisits}
          note={
            mode === "demo"
              ? "Illustrative sample · 30 days"
              : "Unique verified candidate and role pairs · 30 days"
          }
        />
        <Metric
          label="Intake starters"
          value={mode === "demo" ? "38" : funnelMetrics.intakeStarts}
          note={
            mode === "demo"
              ? "Illustrative sample · 30% of visitors"
              : "Unique verified candidate and role pairs · 30 days"
          }
        />
        <Metric
          label="Requests received"
          value={applications.length}
          note="Across all listed roles"
          accent
        />
        <Metric
          label="Awaiting review"
          value={pending.length}
          note="Includes owner checks and resume fixes"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="Intake funnel"
          action={
            mode === "demo" ? (
              <span className="text-xs text-[#87938c]">
                Illustrative sample · 30 days
              </span>
            ) : (
              <span className="text-xs text-[#87938c]">Rolling 30 days</span>
            )
          }
        >
          <div className="space-y-4">
            {(mode === "demo"
              ? [
                  { name: "Visited referral link", value: 126, percent: 100 },
                  { name: "Started intake", value: 38, percent: 30 },
                  { name: "Passed quick checks", value: 24, percent: 19 },
                  {
                    name: "Submitted request",
                    value: applications.length,
                    percent: 13,
                  },
                  {
                    name: "Referred manually",
                    value: referred.length,
                    percent: 4,
                  },
                ]
              : [
                  {
                    name: "Verified role visits",
                    value: funnelMetrics.verifiedRoleVisits,
                  },
                  { name: "Started intake", value: funnelMetrics.intakeStarts },
                  {
                    name: "Passed quick checks",
                    value: funnelMetrics.quickChecksPassed,
                  },
                  {
                    name: "Submitted request",
                    value: funnelMetrics.requestsSubmitted,
                  },
                  {
                    name: "Referral confirmed manually",
                    value: funnelMetrics.referralsConfirmed,
                  },
                ].map((row) => ({
                  ...row,
                  percent:
                    funnelMetrics.verifiedRoleVisits > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (row.value / funnelMetrics.verifiedRoleVisits) *
                              100,
                          ),
                        )
                      : 0,
                }))
            ).map((row) => (
              <div key={row.name}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-[#63736a]">{row.name}</span>
                  <span className="font-semibold text-[#395d4d]">
                    {row.value}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#edf2ee]">
                  <div
                    className="h-full rounded-full bg-[#61927a]"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {mode === "connected" && (
            <p className="mt-4 border-t border-[#edf1ee] pt-3 text-xs leading-5 text-[#89958e]">
              Funnel counts reflect verified candidate and role pairs. A person
              who visits more than one role is counted once for each role.
            </p>
          )}
          {mode === "demo" && (
            <p className="mt-4 border-t border-[#edf1ee] pt-3 text-xs leading-5 text-[#89958e]">
              Funnel counts are illustrative sample values and are not collected
              analytics.
            </p>
          )}
        </Panel>
        <Panel
          title="Needs attention"
          action={
            <span className="rounded-full bg-[#fbf1dc] px-2.5 py-1 text-xs font-semibold text-[#87622a]">
              {actionNeeded.length}
            </span>
          }
        >
          {actionNeeded.length ? (
            <div className="space-y-3">
              {actionNeeded.map((app) => {
                const candidate = candidates.find(
                  (c) => c.id === app.candidateId,
                );
                const job = jobs.find((j) => j.id === app.jobId);
                return (
                  <Link
                    key={app.id}
                    href={`/admin/candidates/${app.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[#edf1ee] p-3 transition hover:border-[#c5d9cc]"
                  >
                    {" "}
                    <div>
                      <p className="text-sm font-semibold text-[#29473c]">
                        {candidate?.firstName} {candidate?.lastName}
                      </p>
                      <p className="mt-1 text-xs text-[#7d8b83]">
                        {job?.title}
                      </p>
                    </div>
                    <StatusPill value={app.status} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Nothing waiting right now"
              text="New requests and manual checks will appear here."
            />
          )}
        </Panel>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Resume corrections"
          value={applications.filter((a) => !a.resumeReady).length}
          note="Missing readable contact fields"
        />
        <Metric
          label="Eligibility checks"
          value={
            applications.filter((a) => a.status === "eligibility_review").length
          }
          note="Needs owner clarification"
        />
        <Metric
          label="Confirmed referrals"
          value={referred.length}
          note="Manually confirmed in sample data"
        />
        <Metric
          label="Status messages"
          value="Not sent"
          note="No email provider configured"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Panel
          title="Recent requests"
          action={
            <Link
              href="/admin/jobs"
              className="text-xs font-semibold text-[#3d775c] hover:underline"
            >
              View jobs →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-[10px] font-bold tracking-[0.13em] text-[#87938c] uppercase">
                  <th className="px-4 pb-3">Candidate</th>
                  <th className="px-4 pb-3">Role</th>
                  <th className="px-4 pb-3">Evidence coverage</th>
                  <th className="px-4 pb-3">Status</th>
                  <th className="px-4 pb-3">Resume</th>
                </tr>
              </thead>
              <tbody>
                {topApps.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    candidate={candidates.find((c) => c.id === app.candidateId)}
                    job={jobs.find((j) => j.id === app.jobId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Recent activity">
          {activity.length ? (
            <ol className="space-y-4">
              {activity.slice(0, 4).map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${event.tone === "positive" ? "bg-[#5b9673]" : event.tone === "warning" ? "bg-[#cc9a48]" : "bg-[#9db1a5]"}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-[#355346]">
                      {event.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#7a8980]">
                      {event.detail}
                    </p>
                    <p className="mt-1 text-[10px] text-[#9aa69f]">
                      {shortDate(event.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty
              title="No activity yet"
              text="Changes made in this demo workspace will show here."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

function Jobs() {
  const { jobs, applications, slots } = useWorkspace();
  const [query, setQuery] = useState("");
  const filtered = jobs.filter((job) =>
    `${job.title} ${job.team} ${job.canonicalJobId}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Owner workspace · Jobs"
        title="Jobs and referral slots"
        description="Manage job details and availability evidence. A slot only closes after a manual confirmation."
        action={
          <Link href="/admin/jobs/new" className={button}>
            ＋ Add a job
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#728178]">
          {jobs.length} roles in this demo workspace
        </p>
        <input
          className={`${input} sm:max-w-xs`}
          aria-label="Search jobs"
          placeholder="Search title, team, or job ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        {filtered.map((job) => {
          const count = applications.filter(
            (app) => app.jobId === job.id,
          ).length;
          const slot = slots.find((item) => item.jobId === job.id) ?? {
            jobId: job.id,
            status: "available" as const,
            updatedAt: job.updatedAt,
          };
          return (
            <Link
              key={job.id}
              href={`/admin/jobs/${job.id}`}
              className={`${card} flex flex-col gap-4 p-5 transition hover:border-[#bfd6c8] sm:flex-row sm:items-center sm:justify-between`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[#254438]">{job.title}</h2>
                  <StatusPill value={job.status} />
                </div>
                <p className="mt-1 text-sm text-[#75847b]">
                  {job.team} <span className="mx-1 text-[#c0cbc4]">·</span>{" "}
                  {job.location}
                </p>
                <p className="mt-2 font-mono text-xs text-[#849188]">
                  {job.canonicalJobId} <span className="mx-1">·</span>{" "}
                  {job.employmentType}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-[#385a4b]">
                    {count} requests
                  </p>
                  <p className="mt-1 text-xs text-[#85928a]">
                    Availability: {titleCase(job.availability)}
                  </p>
                </div>
                <StatusPill
                  value={
                    slot?.status === "available" || !slot
                      ? "slot available"
                      : `slot ${slot.status}`
                  }
                />
                <span className="text-[#6f8d7b]">→</span>
              </div>
            </Link>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="No matching roles"
          text="Try a different search or add a job to this local workspace."
          action={
            <Link href="/admin/jobs/new" className={secondary}>
              Add a job
            </Link>
          }
        />
      )}
    </>
  );
}

function JobForm({ job }: { job?: Job }) {
  const { addJob, updateJob } = useWorkspace();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const locations = String(form.get("locations") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const common: CreateJobInput = {
      canonicalJobId: String(form.get("canonicalJobId") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      team: String(form.get("team") ?? "").trim(),
      location: locations[0] ?? "Location to confirm",
      locations,
      employmentType: String(form.get("employmentType") ?? "Full time"),
      officialUrl: String(form.get("officialUrl") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
    };
    const result = job
      ? await updateJob(job.id, {
          ...common,
          status: job.status,
          availability: job.availability,
        } satisfies UpdateJobInput)
      : await addJob(common);
    setMessage(result.message);
    setPending(false);
    if (result.ok) router.push(job ? `/admin/jobs/${job.id}` : "/admin/jobs");
  }
  return (
    <>
      <PageTitle
        eyebrow={`Owner workspace · Jobs · ${job ? "Edit" : "New"}`}
        title={job ? "Edit role details" : "Add an EA role"}
        description="Store the job information used for evidence review and a candidate facing referral link. Availability stays a manual owner check in this demo."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <form onSubmit={save} className={`${card} space-y-5 p-5 sm:p-7`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#53675d]">
              Canonical EA job ID
              <input
                className={`${input} mt-2 font-mono`}
                required
                name="canonicalJobId"
                placeholder="EA:508741"
                defaultValue={job?.canonicalJobId}
              />
            </label>
            <label className="block text-xs font-semibold text-[#53675d]">
              Official EA job URL
              <input
                className={`${input} mt-2`}
                required
                type="url"
                name="officialUrl"
                placeholder="https://jobs.ea.com/..."
                defaultValue={job?.officialUrl}
              />
            </label>
            <label className="block text-xs font-semibold text-[#53675d]">
              Role title
              <input
                className={`${input} mt-2`}
                required
                name="title"
                placeholder="Senior Gameplay Engineer"
                defaultValue={job?.title}
              />
            </label>
            <label className="block text-xs font-semibold text-[#53675d]">
              Team
              <input
                className={`${input} mt-2`}
                required
                name="team"
                placeholder="EA SPORTS FC"
                defaultValue={job?.team}
              />
            </label>
            <label className="block text-xs font-semibold text-[#53675d]">
              Role locations
              <input
                className={`${input} mt-2`}
                name="locations"
                placeholder="Vancouver, BC, Orlando, FL"
                defaultValue={job?.locations.join(", ")}
              />
              <span className="mt-1.5 block font-normal text-[#87938c]">
                Separate listed locations with commas.
              </span>
            </label>
            <label className="block text-xs font-semibold text-[#53675d]">
              Employment type
              <select
                className={`${input} mt-2`}
                name="employmentType"
                defaultValue={job?.employmentType ?? "Full time"}
              >
                <option>Full time</option>
                <option>Contract</option>
                <option>Internship</option>
                <option>Other / confirm</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-[#53675d]">
            Job description
            <textarea
              className={`${input} mt-2 min-h-44 resize-y leading-6`}
              required
              name="description"
              placeholder="Paste the role description for manual evidence review."
              defaultValue={job?.description}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#edf1ee] pt-5">
            <button className={button} disabled={pending}>
              {pending ? "Saving…" : "Save role"}
            </button>
            <Link
              href={job ? `/admin/jobs/${job.id}` : "/admin/jobs"}
              className={secondary}
            >
              Cancel
            </Link>
            {message && (
              <span role="status" className="text-sm text-[#4c715c]">
                {message}
              </span>
            )}
          </div>
        </form>
        <div className="space-y-4">
          <Notice warning>
            Job status is owner-confirmed. The demo cannot verify EA listings
            automatically or infer that a role is closed.
          </Notice>
          <Panel title="Before sharing">
            <ul className="space-y-3 text-sm leading-5 text-[#68786f]">
              <li>✓ Check canonical job ID and official URL.</li>
              <li>✓ Add locations exactly as listed on the role.</li>
              <li>✓ Paste current job details for a grounded review.</li>
              <li>○ Set availability after checking the official page.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function JobWorkspace({ jobId }: { jobId: string }) {
  const {
    jobs,
    candidates,
    applications,
    slots,
    updateJob,
    updateApplicationStatus,
  } = useWorkspace();
  const job = jobs.find((item) => item.id === jobId);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("match");
  const [notice, setNotice] = useState("");
  if (!job)
    return (
      <Empty
        title="Role not found"
        text="This role may have been removed from the browser demo."
        action={
          <Link className={secondary} href="/admin/jobs">
            Return to jobs
          </Link>
        }
      />
    );
  const jobApps = applications.filter((app) => app.jobId === jobId);
  const slot = slots.find((item) => item.jobId === job.id) ?? {
    jobId: job.id,
    status: "available" as const,
    updatedAt: job.updatedAt,
  };
  let rows = [...jobApps];
  if (filter === "ready") rows = rows.filter((a) => a.resumeReady);
  if (filter === "needs-action")
    rows = rows.filter(
      (a) =>
        !a.resumeReady ||
        a.status === "eligibility_review" ||
        a.status === "correction_required",
    );
  if (filter === "active")
    rows = rows.filter(
      (a) =>
        !["not_selected", "slot_filled_other", "referral_confirmed"].includes(
          a.status,
        ),
    );
  rows.sort(
    sort === "newest"
      ? (a, b) => b.submittedAt.localeCompare(a.submittedAt)
      : (a, b) => b.matchScore - a.matchScore,
  );
  const currentJob = job;
  async function updateAvailability(value: Job["availability"]) {
    const result = await updateJob(currentJob.id, { availability: value });
    setNotice(result.message);
  }
  async function updateJobStatus(value: Job["status"]) {
    const result = await updateJob(currentJob.id, { status: value });
    setNotice(result.message);
  }
  async function move(app: Application, status: ApplicationStatus) {
    const result = await updateApplicationStatus(app.id, status);
    setNotice(result.message);
  }
  const terminalApp = (app: Application) =>
    [
      "referral_confirmed",
      "not_selected",
      "slot_filled_other",
      "selected_pending_submission",
    ].includes(app.status);
  return (
    <>
      <div className="mb-3 text-xs text-[#849188]">
        <Link href="/admin/jobs" className="hover:text-[#376e55]">
          Jobs
        </Link>
        <span className="mx-2">/</span>
        {job.canonicalJobId}
      </div>
      <PageTitle
        eyebrow="Owner workspace · Job workspace"
        title={job.title}
        description={`${job.team} · ${job.location} · ${job.canonicalJobId}`}
        action={
          <Link href={`/admin/jobs/${job.id}/edit`} className={secondary}>
            Edit role
          </Link>
        }
      />
      {notice && (
        <div role="status" className="mb-4">
          <Notice>{notice}</Notice>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Requests"
          value={jobApps.length}
          note="All local sample applications"
          accent
        />
        <Metric
          label="Ready for review"
          value={jobApps.filter((a) => a.resumeReady).length}
          note="Resume contact fields readable"
        />
        <Metric
          label="Average evidence coverage"
          value={
            jobApps.length
              ? `${Math.round(jobApps.reduce((sum, a) => sum + a.matchScore, 0) / jobApps.length)}%`
              : "—"
          }
          note="A review aid, never a decision"
        />
        <Metric
          label="Referral slot"
          value={titleCase(slot.status)}
          note={
            slot.status === "available"
              ? "No reservation or confirmed referral"
              : "Manual owner action recorded"
          }
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <Panel
          title="Candidate requests"
          action={
            <Link
              href={`/admin/compare?job=${job.id}`}
              className="text-xs font-semibold text-[#397759] hover:underline"
            >
              Compare candidates →
            </Link>
          }
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <label className="text-xs font-semibold text-[#63756b]">
              Filter
              <select
                className={`${input} mt-1`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All requests</option>
                <option value="ready">Resume ready</option>
                <option value="needs-action">Needs attention</option>
                <option value="active">Active review</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[#63756b]">
              Sort
              <select
                className={`${input} mt-1`}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="match">Evidence coverage</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>
          {!rows.length ? (
            <Empty
              title={
                jobApps.length
                  ? "No requests match this filter"
                  : "No requests yet"
              }
              text={
                jobApps.length
                  ? "Choose another filter to see the rest of this role’s candidates."
                  : "When a fictional candidate submits in the browser demo, the request appears here."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.12em] text-[#87938c] uppercase">
                    <th className="px-3 pb-3">Candidate</th>
                    <th className="px-3 pb-3">Coverage</th>
                    <th className="px-3 pb-3">Resume</th>
                    <th className="px-3 pb-3">Status</th>
                    <th className="px-3 pb-3">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((app) => {
                    const candidate = candidates.find(
                      (c) => c.id === app.candidateId,
                    );
                    if (!candidate) return null;
                    return (
                      <tr key={app.id} className="border-t border-[#edf1ee]">
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/candidates/${app.id}`}
                            className="font-semibold text-[#2e5746] hover:underline"
                          >
                            {candidate.firstName} {candidate.lastName}
                          </Link>
                          <p className="mt-1 text-xs text-[#85928a]">
                            {app.matchSummary}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-[#3c7358]">
                          {app.matchScore}%
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill
                            value={app.resumeReady ? "ready" : "correction"}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill value={app.status} />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            disabled={terminalApp(app)}
                            aria-label={`Change ${candidate.firstName}'s status`}
                            className="rounded-lg border border-[#dce5df] bg-white px-2 py-1.5 text-xs text-[#466052] disabled:bg-[#f2f4f2] disabled:text-[#8b958e]"
                            value={app.status}
                            onChange={(e) =>
                              move(app, e.target.value as ApplicationStatus)
                            }
                          >
                            <option value={app.status}>
                              {titleCase(app.status)}
                            </option>
                            {(
                              [
                                "needs_clarification",
                                "ready_for_review",
                                "shortlisted",
                                "not_selected",
                              ] as ApplicationStatus[]
                            )
                              .filter((status) => status !== app.status)
                              .map((status) => (
                                <option key={status} value={status}>
                                  {titleCase(status)}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Job availability">
            <p className="text-sm leading-6 text-[#697a70]">
              Status is manually checked. An inaccessible listing stays unknown
              until you confirm it.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <StatusPill
                value={job.availability}
                tone={
                  job.availability === "open"
                    ? "green"
                    : job.availability === "closed"
                      ? "red"
                      : "amber"
                }
              />
              <span className="text-xs text-[#8a968f]">
                {shortDate(job.availabilityCheckedAt)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["open", "unknown", "closed"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => updateAvailability(status)}
                  className={`${secondary} !px-2 text-xs`}
                >
                  {titleCase(status)}
                </button>
              ))}
            </div>
            <a
              href={job.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs font-semibold text-[#397759] underline underline-offset-4"
            >
              Open official EA listing ↗
            </a>
          </Panel>
          <Panel title="Slot controls">
            <p className="text-sm leading-6 text-[#697a70]">
              One provisional reservation at a time. Marking referred is a
              separate manual confirmation after portal success.
            </p>
            <div className="mt-3">
              <StatusPill value={slot.status} />
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/admin/compare?job=${job.id}`} className={secondary}>
                Compare pool
              </Link>
              {slot.applicationId && (
                <Link
                  href={`/admin/referrals/${slot.applicationId}`}
                  className={button}
                >
                  Referral prep
                </Link>
              )}
            </div>
          </Panel>
          <Panel title="Intake status">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#728178]">Current state</span>
              <StatusPill value={job.status} />
            </div>
            {job.status !== "referred" && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["open", "paused", "closed"] as const).map((status) => (
                  <button
                    key={status}
                    className={`${secondary} !px-2 text-xs`}
                    disabled={
                      job.status === status || slot.status === "confirmed"
                    }
                    onClick={() => updateJobStatus(status)}
                  >
                    {titleCase(status)}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-[#89958e]">
              Pausing or closing intake does not change an already submitted
              request. Confirming a referral closes the slot separately.
            </p>
          </Panel>
          <Panel title="Role locations">
            <div className="flex flex-wrap gap-2">
              {job.locations.map((location) => (
                <span
                  key={location}
                  className="rounded-full bg-[#f0f5f1] px-3 py-1.5 text-xs text-[#567063]"
                >
                  {location}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#89958e]">
              {job.employmentType} · {job.status}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function CandidateDetail({ applicationId }: { applicationId: string }) {
  const {
    jobs,
    candidates,
    applications,
    slots,
    activity,
    updateApplication,
    updateApplicationStatus,
    reserveReferral,
    mode,
  } = useWorkspace();
  const app = applications.find((item) => item.id === applicationId);
  const candidate =
    app && candidates.find((item) => item.id === app.candidateId);
  const job = app && jobs.find((item) => item.id === app.jobId);
  const [note, setNote] = useState(app?.adminNote ?? "");
  const [feedback, setFeedback] = useState("");
  if (!app || !candidate || !job)
    return (
      <Empty
        title="Candidate request not found"
        text={
          mode === "demo"
            ? "The request may no longer be in this browser demo workspace."
            : "The request may no longer be available in the connected workspace."
        }
        action={
          <Link href="/admin/jobs" className={secondary}>
            Return to jobs
          </Link>
        }
      />
    );
  const currentApp = app;
  const currentJob = job;
  const slot = slots.find((item) => item.jobId === currentJob.id);
  const canReserve = Boolean(
    app.resumeReady &&
    slot?.status === "available" &&
    ["ready_for_review", "shortlisted"].includes(app.status) &&
    checkEligibility(currentJob, app.eligibility) === "eligible" &&
    ![
      "referral_confirmed",
      "not_selected",
      "slot_filled_other",
      "selected_pending_submission",
    ].includes(app.status),
  );
  const canRequestResumeCorrection = [
    "ready_for_review",
    "shortlisted",
    "needs_clarification",
  ].includes(app.status);
  const history = activity.filter(
    (event) => event.applicationId === currentApp.id,
  );
  async function saveNote() {
    const result = await updateApplication(currentApp.id, { adminNote: note });
    setFeedback(result.message);
  }
  async function decide(status: ApplicationStatus) {
    const result = await updateApplicationStatus(currentApp.id, status);
    setFeedback(result.message);
  }
  async function reserve() {
    const result = await reserveReferral(currentJob.id, currentApp.id);
    setFeedback(result.message);
  }
  const fields = [
    { label: "First name", ok: app.resumeFields.firstName },
    { label: "Last name", ok: app.resumeFields.lastName },
    { label: "Email", ok: app.resumeFields.email },
    { label: "Phone", ok: app.resumeFields.phone },
  ];
  return (
    <>
      <div className="mb-3 text-xs text-[#849188]">
        <Link href={`/admin/jobs/${job.id}`} className="hover:text-[#376e55]">
          {job.title}
        </Link>
        <span className="mx-2">/</span>Candidate details
      </div>
      <PageTitle
        eyebrow="Owner workspace · Candidate review"
        title={`${candidate.firstName} ${candidate.lastName}`}
        description={`${candidate.currentTitle} at ${candidate.currentCompany} · ${candidate.country}`}
        action={
          <Link href={`/admin/compare?job=${job.id}`} className={secondary}>
            Compare in job pool
          </Link>
        }
      />
      {feedback && (
        <div className="mb-4" role="status">
          <Notice>{feedback}</Notice>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel
            title="Request summary"
            action={<StatusPill value={app.status} />}
          >
            <p className="text-sm leading-6 text-[#5d7166]">
              {app.matchSummary}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f5f8f5] p-3">
                <p className="text-[10px] font-bold tracking-wider text-[#839188] uppercase">
                  Evidence coverage
                </p>
                <p className="mt-1 text-xl font-semibold text-[#2c6749]">
                  {app.matchScore}%
                </p>
              </div>
              <div className="rounded-xl bg-[#f5f8f5] p-3">
                <p className="text-[10px] font-bold tracking-wider text-[#839188] uppercase">
                  Received
                </p>
                <p className="mt-1 text-sm font-semibold text-[#395b4b]">
                  {shortDate(app.submittedAt)}
                </p>
              </div>
              <div className="rounded-xl bg-[#f5f8f5] p-3">
                <p className="text-[10px] font-bold tracking-wider text-[#839188] uppercase">
                  Relationship
                </p>
                <p className="mt-1 text-sm font-semibold text-[#395b4b]">
                  {relationshipLabel(candidate.relationship)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#839188]">
              Coverage is a heuristic from the listed evidence. It does not
              predict hiring or make a referral decision.
            </p>
          </Panel>
          <Panel title="Evidence by job requirement">
            <div className="space-y-4">
              {app.requirements.map((req, index) => (
                <div
                  key={`${req.label}-${index}`}
                  className="rounded-xl border border-[#edf1ee] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#325343]">
                      {req.label}
                    </h3>
                    <span className="text-xs text-[#829087]">
                      Weight {req.weight}% <span className="mx-1">·</span>{" "}
                      {req.met ? "Evidence found" : "No evidence found"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#66776d]">
                    {req.evidence}
                  </p>
                  <p className="mt-2 text-xs text-[#8a968f]">
                    Source: {req.citation}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Candidate note and project links">
            {app.showcase.note ? (
              <p className="text-sm leading-6 text-[#64766c]">
                “{app.showcase.note}”
              </p>
            ) : (
              <p className="text-sm text-[#849188]">
                No optional note was shared.
              </p>
            )}
            {app.showcase.links.length > 0 && (
              <ul className="mt-4 space-y-2">
                {app.showcase.links.map((url) => (
                  <li key={url}>
                    <a
                      className="text-sm font-medium break-all text-[#357252] underline decoration-[#b6cebd] underline-offset-4"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {app.showcase.files.length > 0 && (
              <div className="mt-4 border-t border-[#edf1ee] pt-3 text-sm text-[#6c7a72]">
                {app.showcase.files.map((file) => (
                  <div key={`${file.name}-${file.size}`}>
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                    {mode === "connected" && (
                      <PrivateFileDownload fileId={file.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Owner notes">
            <textarea
              className={`${input} min-h-28`}
              placeholder="Private note for your review"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <button className={secondary} onClick={saveNote}>
                {mode === "demo" ? "Save note in demo" : "Save private note"}
              </button>
            </div>
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Resume and contact fields">
            <div className="rounded-xl border border-[#e5ece7] bg-[#f9fbf9] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#355447]">
                    {app.resume.fileName}
                  </p>
                  <p className="mt-1 text-xs text-[#87938c]">
                    Version {app.resume.version} ·{" "}
                    {(app.resume.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>
                <span className="text-lg" aria-hidden="true">
                  ▤
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#829087]">
                {mode === "demo"
                  ? "Local preview has metadata only. The actual document is not available in this demo."
                  : "Private resume access is available only after the file passes the required safety and readiness checks."}
              </p>
              {mode === "connected" && (
                <PrivateFileDownload fileId={app.resumeId} />
              )}
            </div>
            <div className="mt-4 space-y-2">
              {fields.map((field) => (
                <div key={field.label} className="flex justify-between text-sm">
                  <span className="text-[#68796f]">{field.label}</span>
                  <span
                    className={field.ok ? "text-[#478059]" : "text-[#a37431]"}
                  >
                    {field.ok ? "Readable" : "Needs correction"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[#edf1ee] pt-4">
              <p className="text-xs font-semibold text-[#617268]">
                Contact on file
              </p>
              <p className="mt-2 text-sm text-[#53685d]">{candidate.email}</p>
              <p className="mt-1 text-sm text-[#53685d]">{candidate.phone}</p>
            </div>
          </Panel>
          <Panel title="Eligibility answers">
            <div className="space-y-3 text-sm">
              {[
                {
                  label: "Previously applied",
                  value: app.eligibility.previouslyApplied,
                },
                {
                  label: "Previously referred",
                  value: app.eligibility.previouslyReferred,
                },
                { label: "Knows owner", value: app.eligibility.knowsOwner },
                {
                  label: "In listed location",
                  value: app.eligibility.inListedLocation,
                },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-2">
                  <span className="text-[#718077]">{item.label}</span>
                  <span className="font-medium text-[#3d594a]">
                    {item.value === null
                      ? "Needs owner check"
                      : item.value
                        ? "Yes"
                        : "No"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Review actions">
            <div className="space-y-2">
              <button
                className={`${button} w-full`}
                disabled={!canReserve}
                title={
                  !app.resumeReady
                    ? "Resolve resume contact fields first"
                    : slot?.status !== "available"
                      ? "This job slot is not available"
                      : ""
                }
                onClick={reserve}
              >
                Reserve referral slot
              </button>
              <button
                className={`${secondary} w-full`}
                disabled={[
                  "referral_confirmed",
                  "not_selected",
                  "slot_filled_other",
                  "selected_pending_submission",
                ].includes(app.status)}
                onClick={() => decide("shortlisted")}
              >
                Shortlist candidate
              </button>
              <button
                className={`${secondary} w-full`}
                disabled={[
                  "referral_confirmed",
                  "not_selected",
                  "slot_filled_other",
                  "selected_pending_submission",
                ].includes(app.status)}
                onClick={() => decide("needs_clarification")}
              >
                Request clarification
              </button>
              <button
                className={`${secondary} w-full`}
                disabled={!canRequestResumeCorrection}
                onClick={() => decide("correction_required")}
              >
                Request resume correction
              </button>
              <button
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#9b584a] hover:bg-[#fcf2ef]"
                disabled={[
                  "referral_confirmed",
                  "not_selected",
                  "slot_filled_other",
                  "selected_pending_submission",
                ].includes(app.status)}
                onClick={() => decide("not_selected")}
              >
                Mark not selected
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#89958e]">
              {mode === "demo"
                ? "Status changes are recorded only in this browser demo. No candidate is notified."
                : "Changes are saved to the connected workspace. No candidate is notified."}
            </p>
          </Panel>
          <Panel title="Decision history">
            {history.length ? (
              <ul className="space-y-3">
                {history.map((event) => (
                  <li
                    key={event.id}
                    className="border-l-2 border-[#c9ddd0] pl-3"
                  >
                    <p className="text-sm font-medium text-[#486553]">
                      {event.label}
                    </p>
                    <p className="mt-1 text-xs text-[#87938c]">
                      {event.detail}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-[#87938c]">
                {mode === "demo"
                  ? "No recorded decision changes for this sample request."
                  : "No recorded decision changes for this request."}
              </p>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Compare() {
  const { jobs, candidates, applications, updateApplicationStatus } =
    useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [filterJob, setFilterJob] = useState("");
  const pool = applications.filter(
    (app) =>
      (!filterJob || app.jobId === filterJob) &&
      !["not_selected", "slot_filled_other"].includes(app.status),
  );
  const active = selected
    .map((id) => applications.find((app) => app.id === id))
    .filter((app): app is Application => Boolean(app));
  const selectedJobId = selected.length
    ? applications.find((app) => app.id === selected[0])?.jobId
    : undefined;
  function toggle(id: string) {
    const app = applications.find((item) => item.id === id);
    if (!app) return;
    if (selectedJobId && selectedJobId !== app.jobId) return;
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev,
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="Owner workspace · Evidence review"
        title="Compare candidates"
        description="Select two to five candidates for a side-by-side evidence review. The owner makes every referral decision."
      />
      <Notice>
        Evidence coverage is a transparent heuristic. Unknown or missing
        evidence stays visible, and selection never triggers a referral
        automatically.
      </Notice>
      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr]">
        <Panel title="Candidate pool">
          <label className="mb-4 block text-xs font-semibold text-[#63756b]">
            Job
            <select
              className={`${input} mt-1`}
              value={filterJob}
              onChange={(e) => {
                setFilterJob(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">All roles</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            {pool.map((app) => {
              const candidate = candidates.find(
                (c) => c.id === app.candidateId,
              );
              if (!candidate) return null;
              const checked = selected.includes(app.id);
              return (
                <label
                  key={app.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${checked ? "border-[#8fb79c] bg-[#f0f7f1]" : "border-[#e8eeea] hover:bg-[#f8faf8]"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-[#347452]"
                    checked={checked}
                    disabled={
                      !checked &&
                      (selected.length >= 5 ||
                        Boolean(selectedJobId && selectedJobId !== app.jobId))
                    }
                    onChange={() => toggle(app.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#335244]">
                      {candidate.firstName} {candidate.lastName}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#87938c]">
                      {jobs.find((j) => j.id === app.jobId)?.title}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[#4b805e]">
                      {app.matchScore}% evidence coverage
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#89958e]">
            {selected.length} selected · choose 2–5 from the same role
          </p>
        </Panel>
        <div className="space-y-5">
          {active.length < 2 ? (
            <div
              className={`${card} flex min-h-72 items-center justify-center p-8`}
            >
              <Empty
                title="Choose at least two candidates"
                text="Select candidates from the pool to compare requirement evidence and source citations."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[720px] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${active.length}, minmax(210px, 1fr))`,
                }}
              >
                {active.map((app) => {
                  const candidate = candidates.find(
                    (c) => c.id === app.candidateId,
                  );
                  const job = jobs.find((j) => j.id === app.jobId);
                  return (
                    <section key={app.id} className={`${card} overflow-hidden`}>
                      <div className="border-b border-[#edf1ee] p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#284b3c]">
                              {candidate?.firstName} {candidate?.lastName}
                            </p>
                            <p className="mt-1 text-xs text-[#839087]">
                              {candidate?.currentTitle}
                            </p>
                          </div>
                          <button
                            className="text-xs text-[#849188] hover:text-[#a45142]"
                            aria-label="Remove from comparison"
                            onClick={() => toggle(app.id)}
                          >
                            Remove
                          </button>
                        </div>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#3a7756]">
                          {app.matchScore}
                          <span className="text-lg">%</span>
                        </p>
                        <p className="text-[10px] tracking-wider text-[#819087] uppercase">
                          Evidence coverage
                        </p>
                        <div className="mt-3">
                          <StatusPill value={app.status} />
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="mb-3 text-xs font-semibold text-[#546b5d]">
                          {job?.title}
                        </p>
                        <div className="space-y-3">
                          {app.requirements.map((req, i) => (
                            <div
                              key={i}
                              className="border-t border-[#eff2ef] pt-3"
                            >
                              <p className="text-xs font-semibold text-[#52675a]">
                                {req.label}
                              </p>
                              <p className="mt-1 text-[10px] text-[#87938c]">
                                {titleCase(req.category)} · {req.weight}%
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[#718077]">
                                {req.evidence}
                              </p>
                              <p className="mt-1 text-[10px] text-[#9aa59f]">
                                {req.citation}
                              </p>
                            </div>
                          ))}
                        </div>
                        <Link
                          href={`/admin/candidates/${app.id}`}
                          className="mt-4 inline-block text-xs font-semibold text-[#397759] hover:underline"
                        >
                          Full review →
                        </Link>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
          {active.length >= 2 && (
            <Panel title="Review actions">
              <p className="text-sm text-[#728178]">
                Use evidence and owner judgment together. A score does not make
                this choice.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {active.map((app) => (
                  <button
                    key={app.id}
                    onClick={async () => {
                      const result = await updateApplicationStatus(
                        app.id,
                        "shortlisted",
                      );
                      if (result.ok)
                        setSelected((prev) =>
                          prev.filter((id) => id !== app.id),
                        );
                    }}
                    className={secondary}
                  >
                    Shortlist{" "}
                    {
                      candidates.find((c) => c.id === app.candidateId)
                        ?.firstName
                    }
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function ReferralPrep({ applicationId }: { applicationId: string }) {
  const {
    jobs,
    candidates,
    applications,
    slots,
    reserveReferral,
    releaseReferral,
    confirmReferral,
    updateApplication,
    mode,
  } = useWorkspace();
  const app = applications.find((item) => item.id === applicationId);
  const candidate =
    app && candidates.find((item) => item.id === app.candidateId);
  const job = app && jobs.find((item) => item.id === app.jobId);
  const [fitNote, setFitNote] = useState(
    app?.fitNote ?? app?.matchSummary ?? "",
  );
  const [message, setMessage] = useState("");
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState("");
  if (!app || !candidate || !job)
    return (
      <Empty
        title="Referral prep unavailable"
        text={
          mode === "demo"
            ? "This request could not be found in the local sample workspace."
            : "This request could not be found in the connected workspace."
        }
        action={
          <Link href="/admin/jobs" className={secondary}>
            Return to jobs
          </Link>
        }
      />
    );
  const slot = slots.find((item) => item.jobId === job.id) ?? {
    jobId: job.id,
    status: "available" as const,
    updatedAt: job.updatedAt,
  };
  const canReserve =
    slot.status === "available" &&
    isIntakeAvailable(job, applications) &&
    app.resumeReady &&
    ["ready_for_review", "shortlisted"].includes(app.status) &&
    checkEligibility(job, app.eligibility) === "eligible";
  const details = [
    { label: "First name", value: candidate.firstName },
    { label: "Last name", value: candidate.lastName },
    { label: "Email", value: candidate.email },
    { label: "Phone", value: candidate.phone },
    { label: "Country", value: candidate.country },
    { label: "Relationship", value: relationshipLabel(candidate.relationship) },
    { label: "Actively seeking", value: "Yes · owner confirm" },
    {
      label: "In listed location",
      value:
        app.eligibility.inListedLocation === null
          ? "Confirm with candidate"
          : app.eligibility.inListedLocation
            ? "Yes"
            : "No",
    },
  ];
  const allText = `${job.title} (${job.canonicalJobId})\n${candidate.firstName} ${candidate.lastName}\n${candidate.email}\n${candidate.phone}\n${candidate.country}\nRelationship: ${relationshipLabel(candidate.relationship)}\nResume: ${app.resume.fileName}\nFit summary: ${fitNote || app.matchSummary}`;
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied`);
    } catch {
      setCopied("Clipboard access is unavailable in this browser");
    }
  }
  const currentApp = app;
  const currentJob = job;
  async function act(action: "reserve" | "release" | "confirm") {
    const result =
      action === "reserve"
        ? await reserveReferral(currentJob.id, currentApp.id)
        : action === "release"
          ? await releaseReferral(currentJob.id)
          : await confirmReferral(currentJob.id, currentApp.id);
    setMessage(result.message);
    setConfirmOpen(false);
  }
  async function saveFitNote() {
    const result = await updateApplication(currentApp.id, { fitNote });
    setMessage(result.message);
  }
  async function runAssessment() {
    setAssessmentBusy(true);
    setAssessment(null);
    try {
      const response = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: currentApp.id }),
      });
      const result = (await response.json()) as AssessmentResult;
      if (!response.ok) {
        setMessage(
          "The advisory assessment could not be run. Owner review remains available.",
        );
      } else {
        setAssessment(result);
        if (result.status === "available")
          setFitNote(result.assessment.summary);
        setMessage(
          result.status === "available"
            ? "Advisory evidence assessment ready. Review each citation before use."
            : result.reason === "not_configured"
              ? "AI assessment is not configured. Owner review remains available."
              : "AI assessment is unavailable. Owner review remains available.",
        );
      }
    } catch {
      setMessage(
        "The advisory assessment could not be run. Owner review remains available.",
      );
    } finally {
      setAssessmentBusy(false);
    }
  }
  const warnings = [
    !app.resumeReady && "Resume contact fields need correction",
    app.eligibility.previouslyApplied === null &&
      "Previous application answer needs owner review",
    app.eligibility.inListedLocation === null &&
      "Location answer needs owner confirmation",
  ].filter((warning): warning is string => typeof warning === "string");
  return (
    <>
      <div className="mb-3 text-xs text-[#849188]">
        <Link href={`/admin/jobs/${job.id}`} className="hover:text-[#376e55]">
          {job.title}
        </Link>
        <span className="mx-2">/</span>Referral prep
      </div>
      <PageTitle
        eyebrow="Owner workspace · Manual referral"
        title="Referral preparation"
        description={`Review and copy details for manual entry in EA’s referral portal. ${mode === "demo" ? "This browser demo never opens or submits portal fields automatically." : "Portal submission remains a manual owner action; this workspace does not submit on your behalf."}`}
      />
      {message && (
        <div className="mb-4" role="status">
          <Notice>{message}</Notice>
        </div>
      )}
      {!app.resumeReady && (
        <div className="mb-4">
          <Notice warning>
            Resume readiness is incomplete. Resolve the warnings before
            continuing with a referral.
          </Notice>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_350px]">
        <div className="space-y-5">
          <Panel title="Job and candidate">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Eyebrow>EA role</Eyebrow>
                <p className="mt-2 font-semibold text-[#2d4c3f]">{job.title}</p>
                <p className="mt-1 font-mono text-xs text-[#7c8a81]">
                  {job.canonicalJobId}
                </p>
                <a
                  href={job.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-[#397759] underline underline-offset-4"
                >
                  Open EA job listing ↗
                </a>
              </div>
              <div>
                <Eyebrow>Candidate</Eyebrow>
                <p className="mt-2 font-semibold text-[#2d4c3f]">
                  {candidate.firstName} {candidate.lastName}
                </p>
                <p className="mt-1 text-sm text-[#748279]">
                  {candidate.currentTitle} · {candidate.currentCompany}
                </p>
                <Link
                  className="mt-3 inline-block text-xs font-semibold text-[#397759] hover:underline"
                  href={`/admin/candidates/${app.id}`}
                >
                  Back to candidate review →
                </Link>
              </div>
            </div>
          </Panel>
          <Panel
            title="Referral fields"
            action={
              <button
                className={secondary}
                onClick={() => copy("All details", allText)}
              >
                Copy all details
              </button>
            }
          >
            <div className="divide-y divide-[#edf1ee]">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-[10px] font-bold tracking-wider text-[#849188] uppercase">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-[#385448]">{item.value}</p>
                  </div>
                  <button
                    className="rounded-lg border border-[#dce5df] px-3 py-1.5 text-xs font-semibold text-[#47745b] hover:bg-[#f5f8f5]"
                    onClick={() => copy(item.label, item.value)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
            {copied && (
              <p className="mt-3 text-xs text-[#4d815e]" role="status">
                {copied}
              </p>
            )}
            <p className="mt-4 border-t border-[#edf1ee] pt-3 text-xs leading-5 text-[#87938c]">
              {mode === "demo"
                ? "Fields are from the submitted sample. Review every value before pasting into an external form."
                : "Fields are from the submitted application. Review every value before pasting into an external form."}
            </p>
          </Panel>
          <Panel title="Resume and optional files">
            <div className="flex items-start justify-between rounded-xl bg-[#f7faf7] p-4">
              <div>
                <p className="text-sm font-semibold text-[#355447]">
                  {app.resume.fileName}
                </p>
                <p className="mt-1 text-xs text-[#849188]">
                  {app.resume.fileType} ·{" "}
                  {(app.resume.fileSize / 1024).toFixed(0)} KB · version{" "}
                  {app.resume.version}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#87938c]">
                  {mode === "demo"
                    ? "The demo has metadata only; it cannot download a real resume file."
                    : "Private file downloads require a clean scan and, for resumes, completed readiness checks."}
                </p>
                {mode === "connected" && (
                  <PrivateFileDownload fileId={app.resumeId} />
                )}
              </div>
              <span className="rounded-full bg-[#e8f3eb] px-2.5 py-1 text-[10px] font-semibold text-[#447554]">
                {app.resumeReady ? "Ready" : "Correction needed"}
              </span>
            </div>
            {app.showcase.files.length > 0 && (
              <div className="mt-3 space-y-2">
                {app.showcase.files.map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="text-xs text-[#6e7e74]"
                  >
                    Supporting file: {file.name} ·{" "}
                    {(file.size / 1024).toFixed(0)} KB
                    {mode === "demo" ? " (not included in this demo)" : ""}
                    {mode === "connected" && (
                      <PrivateFileDownload fileId={file.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Professional fit summary">
            <p className="text-xs leading-5 text-[#87938c]">
              {mode === "demo"
                ? "This editable summary uses the sample evidence below. Verify it yourself; the demo does not generate AI content."
                : "This editable summary is advisory. You can request an AI evidence assessment; you remain responsible for reviewing every claim and citation."}
            </p>
            {mode === "connected" && (
              <div className="mt-3 rounded-xl bg-[#f7faf7] p-3 text-xs leading-5 text-[#687a70]">
                Running an assessment sends the resume text and job description
                to the configured AI Gateway after email, phone, and candidate
                name are redacted. The request runs only when you select the
                button below.
              </div>
            )}
            {mode === "connected" && (
              <button
                className={`${secondary} mt-3`}
                disabled={assessmentBusy || !app.resumeReady}
                onClick={runAssessment}
              >
                {assessmentBusy
                  ? "Assessing evidence…"
                  : "Run advisory assessment"}
              </button>
            )}
            {assessment?.status === "available" && (
              <div className="mt-4 rounded-xl border border-[#dce5df] p-4">
                <p className="text-sm font-semibold text-[#355447]">
                  {assessment.evidenceCoveragePercent}% evidence coverage
                </p>
                <p className="mt-1 text-xs leading-5 text-[#748279]">
                  Deterministic coverage heuristic; not a hiring or referral
                  probability. The owner makes every decision.
                </p>
                <p className="mt-3 text-xs text-[#849188]">
                  Model {assessment.audit.returnedModel} · prompt{" "}
                  {assessment.audit.promptVersion} ·{" "}
                  {new Date(assessment.audit.completedAt).toLocaleString()}
                </p>
                <div className="mt-3 space-y-3 border-t border-[#edf1ee] pt-3">
                  {assessment.assessment.criteria.map((criterion, index) => (
                    <div
                      key={`${criterion.category}-${index}`}
                      className="text-xs leading-5 text-[#617269]"
                    >
                      <p className="font-semibold text-[#385448]">
                        {titleCase(criterion.category)} ·{" "}
                        {titleCase(criterion.level)} · {criterion.criterion}
                      </p>
                      <p>{criterion.rationale}</p>
                      {criterion.citations.map((citation, citationIndex) => (
                        <blockquote
                          key={`${citation.source}-${citation.start}-${citationIndex}`}
                          className="mt-1 border-l-2 border-[#b5cfbe] pl-2 text-[#75847b]"
                        >
                          {citation.source === "resume"
                            ? "Resume"
                            : "Job description"}
                          : “{citation.quote}”
                        </blockquote>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <textarea
              className={`${input} mt-3 min-h-32`}
              aria-label="Editable fit summary"
              placeholder="Write a concise summary based on the cited evidence."
              value={fitNote}
              onChange={(e) => setFitNote(e.target.value)}
            />
            <div className="mt-3 flex justify-between">
              <button className={secondary} onClick={saveFitNote}>
                {mode === "demo" ? "Save summary in demo" : "Save fit summary"}
              </button>
              <button
                className={secondary}
                onClick={() => copy("Fit summary", fitNote || app.matchSummary)}
              >
                Copy summary
              </button>
            </div>
            <div className="mt-4 space-y-2 border-t border-[#edf1ee] pt-4">
              {app.evidence.map((item) => (
                <p
                  key={item}
                  className="flex gap-2 text-sm leading-5 text-[#617269]"
                >
                  <span className="text-[#5a906f]">↳</span>
                  {item}
                </p>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Reservation state">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#728178]">Job slot</span>
              <StatusPill value={slot.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#748279]">
              {mode === "demo"
                ? "A reservation pauses new intake in the browser demo. It does not mean EA portal submission succeeded."
                : "A reservation pauses new intake for this job. It does not mean EA portal submission succeeded."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {slot.status === "available" && (
                <button
                  className={button}
                  disabled={!canReserve}
                  title={
                    !canReserve
                      ? "Resolve the request, eligibility, and job availability checks first"
                      : ""
                  }
                  onClick={() => act("reserve")}
                >
                  Reserve referral slot
                </button>
              )}
              {slot.status === "reserved" && slot.applicationId === app.id && (
                <>
                  <button
                    className={button}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Mark as referred
                  </button>
                  <button className={secondary} onClick={() => act("release")}>
                    Release reservation
                  </button>
                </>
              )}
              {slot.status === "confirmed" && slot.applicationId === app.id && (
                <StatusPill value="referral confirmed" tone="green" />
              )}
              {slot.status === "reserved" && slot.applicationId !== app.id && (
                <Notice warning>
                  Another candidate currently holds this job’s reservation. This
                  page cannot release or confirm their slot.
                </Notice>
              )}
              {slot.status === "confirmed" && slot.applicationId !== app.id && (
                <Notice warning>
                  This job’s referral was confirmed for another candidate.
                </Notice>
              )}
            </div>
          </Panel>
          <Panel title="Before confirming">
            <ul className="space-y-3 text-sm leading-5">
              {[
                "Open the EA portal and complete the referral manually",
                "Confirm the job ID and candidate before marking referred",
                "Only confirm after the portal reports success",
              ].map((line, i) => (
                <li key={line} className="flex gap-2 text-[#697a70]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#edf4ef] text-[10px] font-bold text-[#4d775c]">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            {warnings.filter(Boolean).length > 0 && (
              <div className="mt-4 border-t border-[#edf1ee] pt-4">
                <p className="mb-2 text-xs font-semibold text-[#866533]">
                  Needs review
                </p>
                <ul className="space-y-2">
                  {warnings.filter(Boolean).map((warning) => (
                    <li
                      key={warning}
                      className="text-xs leading-5 text-[#876b3f]"
                    >
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href="https://jobs.ea.com/en_US/careers"
              target="_blank"
              rel="noreferrer"
              className={`${secondary} mt-4 w-full`}
            >
              Open EA careers ↗
            </a>
          </Panel>
        </aside>
      </div>
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#17352e]/35 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className={`${card} w-full max-w-lg p-6`}
          >
            <Eyebrow>Manual action confirmation</Eyebrow>
            <h2
              id="confirm-title"
              className="mt-2 text-xl font-semibold text-[#244638]"
            >
              Confirm referral submitted
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6b7b72]">
              Confirm that you submitted{" "}
              <strong>
                {candidate.firstName} {candidate.lastName}
              </strong>{" "}
              for{" "}
              <strong>
                {job.title} ({job.canonicalJobId})
              </strong>{" "}
              in EA’s referral portal. This closes the referral slot.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={secondary}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button className={button} onClick={() => act("confirm")}>
                Yes, portal succeeded
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Notifications() {
  const { jobs, candidates, applications } = useWorkspace();
  const [jobId, setJobId] = useState("");
  const [group, setGroup] = useState("remaining");
  const [selected, setSelected] = useState<string[]>([]);
  const terminal = ["referral_confirmed", "not_selected", "slot_filled_other"];
  const pool = applications.filter(
    (app) => (!jobId || app.jobId === jobId) && !terminal.includes(app.status),
  );
  const referred = applications.filter(
    (app) =>
      (!jobId || app.jobId === jobId) && app.status === "referral_confirmed",
  );
  const groupedRecipients =
    group === "referred"
      ? referred
      : pool.filter((app) => app.status !== "selected_pending_submission");
  const seenEmails = new Set<string>();
  const recipients = groupedRecipients.filter((app) => {
    const email = candidates
      .find((candidate) => candidate.id === app.candidateId)
      ?.email.trim()
      .toLowerCase();
    if (!email || seenEmails.has(email)) return false;
    seenEmails.add(email);
    return true;
  });
  const recipientCandidate = recipients.find((app) =>
    selected.includes(app.id),
  );
  const person =
    recipientCandidate &&
    candidates.find((c) => c.id === recipientCandidate.candidateId);
  const job =
    recipientCandidate && jobs.find((j) => j.id === recipientCandidate.jobId);
  const greeting =
    selected.length === 1 ? (person?.firstName ?? "there") : "{{firstName}}";
  const template =
    group === "referred"
      ? `Hi ${greeting},\n\nI submitted your referral for ${job?.title ?? "the role"}. That confirms the referral was sent, but it does not guarantee an interview or offer.\n\nBest,\nYour EA contact`
      : `Hi ${greeting},\n\nI’m sorry, but I’m not able to refer you for ${job?.title ?? "this role"}. I’ve confirmed a referral for this opening, and I can only make one referral for this job ID. I appreciate you taking the time to apply.\n\nBest,\nYour EA contact`;
  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="Owner workspace · Communications"
        title="Notification review"
        description="Preview sample messages and review recipient groups. This workspace has no email provider, so sending is unavailable."
      />
      <div className="mb-5">
        <Notice warning>
          Sending is disabled: no email provider is configured. Nothing will be
          delivered from this browser demo.
        </Notice>
      </div>
      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Panel title="Recipients">
          <label className="mb-3 block text-xs font-semibold text-[#63756b]">
            Job
            <select
              className={`${input} mt-1`}
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-4 block text-xs font-semibold text-[#63756b]">
            Message group
            <select
              className={`${input} mt-1`}
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setSelected([]);
              }}
            >
              <option value="remaining">Other applicants</option>
              <option value="referred">Referred candidate</option>
            </select>
          </label>
          <p className="mb-2 text-xs text-[#87938c]">
            {recipients.length} eligible sample recipients
          </p>
          {!recipients.length ? (
            <Empty
              title="No recipients in this group"
              text="Finalized statuses and duplicate recipients are excluded from the other applicants list."
            />
          ) : (
            <div className="max-h-[450px] space-y-1 overflow-auto">
              {recipients.map((app) => {
                const c = candidates.find(
                  (item) => item.id === app.candidateId,
                );
                if (!c) return null;
                return (
                  <label
                    key={app.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#f5f8f5]"
                  >
                    <input
                      type="checkbox"
                      className="accent-[#347452]"
                      checked={selected.includes(app.id)}
                      onChange={() => toggle(app.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-[#385548]">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#87938c]">
                        {c.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 border-t border-[#edf1ee] pt-4">
            <p className="text-xs font-semibold text-[#596f62]">
              Default exclusions
            </p>
            <p className="mt-1 text-xs leading-5 text-[#87938c]">
              Referral confirmed, not selected, slot filled, and already
              notified applicants.
            </p>
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel
            title="Message preview"
            action={
              <StatusPill
                value={
                  group === "referred" ? "Referral confirmation" : "Slot filled"
                }
              />
            }
          >
            <div className="rounded-xl border border-[#e7ece8] bg-[#fbfcfb] p-5">
              <p className="mb-4 text-xs text-[#849188]">
                To:{" "}
                {selected.length
                  ? selected.length === 1
                    ? person?.email
                    : `${selected.length} selected candidates`
                  : "Select a recipient to preview the address"}
              </p>
              <pre className="font-sans text-sm leading-7 whitespace-pre-wrap text-[#53665b]">
                {template}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#87938c]">
                Preview only · no messages queued
              </p>
              <div className="flex gap-2">
                <button
                  className={secondary}
                  disabled={!selected.length}
                  onClick={() => navigator.clipboard?.writeText(template)}
                >
                  Copy preview
                </button>
                <button
                  className={button}
                  disabled
                  title="Email provider setup is required"
                >
                  Send disabled
                </button>
              </div>
            </div>
          </Panel>
          <Panel title="Recipient summary">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Selected"
                value={selected.length}
                note="Manual preview selection"
              />
              <Metric
                label="Available"
                value={recipients.length}
                note="After default exclusions"
              />
              <Metric
                label="Configured provider"
                value="None"
                note="Email is not connected"
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-[#87938c]">
              Confirm the job and recipient list before any future sending
              feature. Delivery would be a separate step from changing
              application status.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Settings() {
  const { jobs, activity, resetDemo, mode, session } = useWorkspace();
  const [message, setMessage] = useState("");
  const [deletionRequests, setDeletionRequests] = useState<
    {
      id: string;
      requestedAt: string;
      status: string;
      completedAt: string | null;
    }[]
  >([]);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadDeletionRequests = useCallback(async () => {
    setDeletionLoading(true);
    try {
      const response = await fetch("/api/admin/deletion-requests", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("requests" in body) ||
        !Array.isArray(body.requests)
      ) {
        throw new Error("Deletion requests could not be loaded.");
      }
      setDeletionRequests(
        body.requests
          .filter(
            (
              item,
            ): item is {
              id: string;
              requestedAt: string;
              status: string;
              completedAt: string | null;
            } =>
              !!item &&
              typeof item === "object" &&
              "id" in item &&
              typeof item.id === "string" &&
              "requestedAt" in item &&
              typeof item.requestedAt === "string" &&
              "status" in item &&
              typeof item.status === "string" &&
              "completedAt" in item &&
              (typeof item.completedAt === "string" ||
                item.completedAt === null),
          )
          .slice(0, 25),
      );
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Deletion requests could not be loaded.",
      );
    } finally {
      setDeletionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "connected" && session?.isAdmin === true)
      queueMicrotask(() => void loadDeletionRequests());
  }, [mode, session?.isAdmin, loadDeletionRequests]);

  async function processDeletionRequest(id: string) {
    setProcessingId(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/deletion-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok)
        throw new Error("The deletion request could not be processed.");
      await loadDeletionRequests();
      setMessage(
        "Deletion request processed. Private file objects were removed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The deletion request could not be processed.",
      );
    } finally {
      setProcessingId(null);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Owner workspace · Configuration"
        title="Settings and audit"
        description="Review demo configuration, decision safeguards, and recorded local actions."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <Panel title="Workspace access">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#395749]">
                  {mode === "demo"
                    ? "Browser demo only"
                    : (session?.user?.email ?? "Verified owner account")}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#87938c]">
                  {mode === "demo"
                    ? "No real admin authentication or account allowlist is configured."
                    : "Connected workspace access was verified for this admin session."}
                </p>
              </div>
              <StatusPill
                value={mode === "demo" ? "not authenticated" : "owner verified"}
                tone={mode === "demo" ? "amber" : "green"}
              />
            </div>
          </Panel>
          <Panel title="Review defaults">
            <div className="divide-y divide-[#edf1ee]">
              {[
                {
                  key: "evidence",
                  label: "Evidence rubric",
                  value:
                    "Mandatory 45% · Relevant work 30% · Preferred 15% · Achievements 10%",
                },
                {
                  key: "source",
                  label: "Job source",
                  value: "EA public careers page · manually verified",
                },
                {
                  key: "eligibility",
                  label: "Eligibility policy",
                  value: "Owner review when answer is unknown",
                },
                {
                  key: "availability",
                  label: "Availability",
                  value: "Unknown until confirmed",
                },
                {
                  key: "referrals",
                  label: "Referrals per job ID",
                  value: "One confirmed referral",
                },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-sm text-[#6d7c73]">{row.label}</span>
                  <span className="text-sm font-medium text-[#42604f]">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-[#edf1ee] pt-3 text-xs text-[#89958e]">
              Values reflect the supplied product requirements; no unverified EA
              policy is inferred.
            </p>
          </Panel>
          <Panel title="Notification templates">
            <div className="space-y-3">
              {[
                {
                  title: "Referral confirmed",
                  value:
                    "Warm, short confirmation after owner marks manual portal success.",
                },
                {
                  title: "Referral unavailable",
                  value:
                    "Respectful update after the slot is confirmed for another applicant.",
                },
                {
                  title: "Action needed",
                  value:
                    "Specific correction request without claiming the EA parser is guaranteed.",
                },
              ].map((x) => (
                <div key={x.title} className="rounded-xl bg-[#f7faf7] p-3">
                  <p className="text-sm font-semibold text-[#405e4d]">
                    {x.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#7b8981]">
                    {x.value}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/admin/notifications"
              className="mt-4 inline-block text-xs font-semibold text-[#397759] hover:underline"
            >
              Open notification preview →
            </Link>
          </Panel>
          {mode === "connected" && session?.isAdmin === true && (
            <Panel
              title="Data deletion requests"
              action={
                <button
                  className={secondary}
                  disabled={deletionLoading}
                  onClick={() => void loadDeletionRequests()}
                >
                  Refresh
                </button>
              }
            >
              <p className="mb-4 text-xs leading-5 text-[#87938c]">
                Requests contain no candidate identity in this view. Processing
                removes private uploaded file objects and records completion.
              </p>
              {deletionLoading && deletionRequests.length === 0 ? (
                <p className="text-sm text-[#748279]">Loading requests…</p>
              ) : deletionRequests.length === 0 ? (
                <p className="text-sm text-[#748279]">
                  No deletion requests are waiting.
                </p>
              ) : (
                <ul className="space-y-3">
                  {deletionRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf1ee] p-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#52675c]">
                          Request {request.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-[#87938c]">
                          Requested {shortDate(request.requestedAt)} ·{" "}
                          {titleCase(request.status)}
                        </p>
                      </div>
                      {request.status === "pending" ? (
                        <button
                          className={secondary}
                          disabled={processingId !== null}
                          onClick={() =>
                            void processDeletionRequest(request.id)
                          }
                        >
                          {processingId === request.id
                            ? "Processing…"
                            : "Process deletion"}
                        </button>
                      ) : (
                        <span className="text-xs text-[#63816d]">
                          Completed {shortDate(request.completedAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {message && (
                <p className="mt-3 text-xs text-[#52765d]" role="status">
                  {message}
                </p>
              )}
            </Panel>
          )}
        </div>
        <div className="space-y-5">
          <Panel
            title="Audit and activity"
            action={
              <span className="text-xs text-[#87938c]">
                {activity.length} local events
              </span>
            }
          >
            {activity.length ? (
              <ol className="space-y-0">
                {activity.map((event) => (
                  <li
                    key={event.id}
                    className="relative border-l border-[#dce8df] pb-5 pl-5 last:border-l-transparent last:pb-0"
                  >
                    <span
                      className={`absolute top-1 -left-[5px] size-2 rounded-full ${event.tone === "positive" ? "bg-[#5b9673]" : event.tone === "warning" ? "bg-[#cc9a48]" : "bg-[#9db1a5]"}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#405b4d]">
                        {event.label}
                      </p>
                      <time className="text-[10px] text-[#98a39c]">
                        {shortDate(event.at)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#7c8981]">
                      {event.detail}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty
                title="No events yet"
                text="Local demo actions will appear here when the workspace records them."
              />
            )}
          </Panel>
          <Panel title="Current job availability">
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#edf1ee] p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#3a5949]">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-[#849188]">
                      {job.canonicalJobId} · checked{" "}
                      {shortDate(job.availabilityCheckedAt)}
                    </p>
                  </div>
                  <StatusPill value={job.availability} />
                </div>
              ))}
            </div>
          </Panel>
          {mode === "demo" && (
            <Panel title="Reset this browser demo">
              <p className="text-sm leading-6 text-[#738178]">
                Reset restores the original fictional sample records and removes
                local changes from this browser tab.
              </p>
              <button
                className="mt-4 rounded-xl border border-[#edd4cd] px-4 py-2.5 text-sm font-semibold text-[#985849] hover:bg-[#fcf2ef]"
                onClick={() => {
                  resetDemo();
                  setMessage("Demo data reset for this browser tab.");
                }}
              >
                Reset demo data
              </button>
              {message && (
                <p className="mt-3 text-xs text-[#52765d]" role="status">
                  {message}
                </p>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminWorkspace() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[1] ?? "overview";
  const id = parts[2];
  const { jobs, applications } = useWorkspace();
  const job = jobs.find((item) => item.id === id);
  if (section === "overview") return <Dashboard />;
  if (section === "jobs" && id === "new") return <JobForm />;
  if (section === "jobs" && id && parts[3] === "edit")
    return <JobForm job={job} />;
  if (section === "jobs" && id) return <JobWorkspace jobId={id} />;
  if (section === "jobs") return <Jobs />;
  if (section === "candidates" && id)
    return <CandidateDetail applicationId={id} />;
  if (section === "compare") return <Compare />;
  if (section === "referrals" && id) return <ReferralPrep applicationId={id} />;
  if (section === "notifications") return <Notifications />;
  if (section === "settings") return <Settings />;
  return (
    <Empty
      title="Choose a workspace view"
      text={`There are ${applications.length} ${applications.length === 1 ? "request" : "requests"} across ${jobs.length} ${jobs.length === 1 ? "role" : "roles"}.`}
      action={
        <Link href="/admin" className={secondary}>
          Open overview
        </Link>
      }
    />
  );
}
