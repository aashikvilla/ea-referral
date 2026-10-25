import {
  CandidateShell,
  Eyebrow,
} from "@/components/candidate/candidate-shell";

export default function PrivacyPage() {
  return (
    <CandidateShell>
      <article className="mx-auto max-w-3xl px-5 pt-10 pb-8 sm:px-8 sm:pt-16">
        <Eyebrow>Privacy, in plain language</Eyebrow>
        <h1 className="mt-4 font-serif text-5xl leading-tight tracking-[-0.04em] text-[#173d32]">
          Your information stays part of your request.
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#52645d]">
          This assistant helps one EA employee review referral requests. It is
          not run by EA, and submitting a request does not apply for a job or
          guarantee a referral.
        </p>
        <div className="mt-9 rounded-2xl border border-[#d6e5dc] bg-[#eef5f0] p-5 text-sm leading-6 text-[#466558]">
          In demo mode, details you enter and fictional requests stay in this
          browser tab&apos;s memory and are cleared when the tab is closed or
          refreshed. Selected files are not uploaded. In connected mode, data
          submitted to the configured service is stored for review by the
          employee who shared the link; use the deletion request below to ask
          for its removal.
        </div>
        <div className="mt-10 space-y-9">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-[#254a3d]">
              What a real request may include
            </h2>
            <p className="mt-3 leading-7 text-[#5f6f67]">
              If you choose to submit in a configured service, the request may
              include the contact and eligibility details you provide, your
              resume, and any optional links or supporting files you add. A
              resume is requested only after the role and eligibility steps.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-[#254a3d]">
              Resume review
            </h2>
            <p className="mt-3 leading-7 text-[#5f6f67]">
              A resume may be checked for whether your name, email, and phone
              number are readable as text. Passing a local check cannot
              guarantee that EA’s referral form will read the document
              correctly. Any automated processing would need to be disclosed
              before upload.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-[#254a3d]">
              Optional work samples
            </h2>
            <p className="mt-3 leading-7 text-[#5f6f67]">
              You can skip the optional showcase. In the intended flow, a note
              is limited to 500 characters and supporting files together may be
              no larger than 10 MiB. Skipping it does not count against you.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-[#254a3d]">
              Status and email
            </h2>
            <p className="mt-3 leading-7 text-[#5f6f67]">
              A real status page must be protected by a link verified through
              your email. This demo cannot send that email, so it does not
              pretend to verify an address or reveal application status.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-[#254a3d]">
              Questions or deletion
            </h2>
            <p className="mt-3 leading-7 text-[#5f6f67]">
              In connected mode, sign in with the verified email used for your
              request, then submit a deletion request from your private status
              page. The service has no configured retention period yet. In demo
              mode, closing or refreshing this tab clears its in-memory sample
              details.
            </p>
          </section>
        </div>
      </article>
    </CandidateShell>
  );
}
