export type AvailabilityResult = {
  status: "open" | "closed" | "unknown";
  checkedAt: string | null;
  source: "manual" | "official" | "unknown";
  reason: string;
};

export interface JobAvailabilityProvider {
  check(canonicalJobId: string): Promise<AvailabilityResult>;
}

export class ManualAvailabilityProvider implements JobAvailabilityProvider {
  async check(): Promise<AvailabilityResult> {
    return {
      status: "unknown",
      checkedAt: null,
      source: "unknown",
      reason: "Availability requires owner confirmation.",
    };
  }
}

export interface ResumeParser {
  extract(_file: Uint8Array, _contentType: string): Promise<never>;
}

export class ParserUnavailable implements ResumeParser {
  async extract(): Promise<never> {
    throw new Error(
      "Resume parsing is not configured; a client readiness claim is never trusted.",
    );
  }
}

export interface CandidateAssessmentProvider {
  assess(_resumeText: string, _jobDescription: string): Promise<never>;
}

export class AssessmentUnavailable implements CandidateAssessmentProvider {
  async assess(): Promise<never> {
    throw new Error(
      "Candidate assessment is unavailable. Owner review remains required.",
    );
  }
}

export interface NotificationProvider {
  send(
    _recipient: string,
    _subject: string,
    _body: string,
    _idempotencyKey: string,
  ): Promise<never>;
}

export class NotificationUnavailable implements NotificationProvider {
  async send(): Promise<never> {
    throw new Error(
      "Email delivery is not configured; no notification was sent.",
    );
  }
}
