---
name: referral-privacy
description: Use when adding or reviewing referral request forms, contact details, resumes, profile links, notifications, analytics, storage, sharing, or other flows that may handle personal data.
---

# Referral data privacy workflow

- Confirm the purpose and minimum required fields before collecting personal information. Do not infer retention periods or collect resumes, phone numbers, or profile details without a product requirement.
- Treat a public referral link as an abuse surface. Consider validation, rate limits, spam controls, and safe error responses before accepting submissions.
- Enforce authorization on the server for private data. Never rely on hidden UI controls as access control.
- Keep secrets and privileged credentials on the server. Redact personal information from logs, telemetry, and error messages.
- Escape or safely render user-submitted content. Validate URLs and avoid open redirects, SSRF, and unsafe HTML.
- Do not send messages, contact people, scrape LinkedIn, or automate LinkedIn actions unless the user explicitly asks and an authorized, documented integration supports the action.
- Before proposing storage, sharing, or retention behavior, state the privacy implications and seek any missing product decision.
- Report security and privacy findings with the affected flow and a concrete remediation.
