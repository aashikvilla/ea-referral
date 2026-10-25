import test from "node:test";
import assert from "node:assert/strict";
import {
  assessWithGateway,
  redactAssessmentText,
  validateAssessmentOutput,
} from "../src/server/assessment.ts";

test("assessment text redacts candidate identifiers before sending", () => {
  const source =
    "Jane Example\nJANE@example.invalid\n+1 (555) 123-4567\nEngineer";
  const result = redactAssessmentText(source, {
    name: "Jane Example",
    email: "jane@example.invalid",
    phone: "+1 (555) 123-4567",
  });
  assert.doesNotMatch(result, /Jane Example|jane@example\.invalid|555/);
  assert.match(result, /Engineer/);
});

test("assessment accepts only exact source citations and supported claims", () => {
  const resume = "Built a C++ gameplay system.";
  const jobDescription = "Build gameplay systems in C++.";
  const valid = {
    summary: "Resume evidence describes a C++ gameplay system.",
    criteria: [
      {
        category: "mandatory",
        criterion: "C++ gameplay systems",
        level: "demonstrated",
        rationale: "The resume describes a gameplay system built in C++.",
        citations: [
          {
            source: "resume",
            start: 6,
            end: 28,
            quote: "a C++ gameplay system.",
          },
          {
            source: "job_description",
            start: 0,
            end: jobDescription.length,
            quote: jobDescription,
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    validateAssessmentOutput(valid, { resume, jobDescription }),
    valid,
  );
  assert.equal(
    validateAssessmentOutput(
      {
        ...valid,
        criteria: valid.criteria.map((item) => ({
          ...item,
          citations: [{ ...item.citations[0], quote: "invented quote" }],
        })),
      },
      { resume, jobDescription },
    ),
    null,
  );
  assert.equal(
    validateAssessmentOutput(
      {
        ...valid,
        extra: "reject unexpected keys",
      },
      { resume, jobDescription },
    ),
    null,
  );
});

test("unconfigured Gateway assessment falls back without making a request", async () => {
  let called = false;
  const result = await assessWithGateway({
    resumeText: "Experience",
    jobDescription: "Role",
    fetcher: async () => {
      called = true;
      throw new Error("must not call without config");
    },
  });
  assert.deepEqual(result, { status: "unavailable", reason: "not_configured" });
  assert.equal(called, false);
});

test("Gateway assessment returns validated evidence coverage and audit metadata", async () => {
  const resumeText = "Built a C++ gameplay system.";
  const jobDescription = "Build gameplay systems in C++.";
  const assessment = {
    summary: "The resume describes a C++ gameplay system.",
    criteria: [
      {
        category: "mandatory",
        criterion: "C++ gameplay systems",
        level: "demonstrated",
        rationale: "The resume describes a gameplay system built in C++.",
        citations: [
          {
            source: "resume",
            start: 6,
            end: 28,
            quote: "a C++ gameplay system.",
          },
          {
            source: "job_description",
            start: 0,
            end: jobDescription.length,
            quote: jobDescription,
          },
        ],
      },
    ],
  };
  let requestBody;
  const result = await assessWithGateway({
    resumeText,
    jobDescription,
    apiKey: "test-key",
    model: "provider/test-model-version",
    now: () => new Date("2026-10-25T00:00:00.000Z"),
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return Response.json({
        model: "provider/test-model-version",
        choices: [{ message: { content: JSON.stringify(assessment) } }],
      });
    },
  });
  assert.equal(result.status, "available");
  assert.equal(result.evidenceCoveragePercent, 45);
  assert.equal(result.audit.requestedModel, "provider/test-model-version");
  assert.equal(result.audit.returnedModel, "provider/test-model-version");
  assert.equal(result.audit.schemaVersion, "ea-evidence-assessment-v1");
  assert.equal(result.audit.completedAt, "2026-10-25T00:00:00.000Z");
  assert.equal(requestBody.response_format.json_schema.strict, true);
  assert.match(requestBody.messages[0].content, /untrusted data/i);
});
