import assert from "node:assert/strict";
import test from "node:test";

import { POST as checkAvailability } from "../src/app/api/jobs/availability/route.ts";
import { checkEaListingAvailability } from "../src/server/ea-listing-availability.ts";

const checkedAt = new Date("2026-11-08T12:00:00.000Z");

function postingPage({ id = "508741", validThrough } = {}) {
  const posting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: { "@type": "PropertyValue", value: id },
    validThrough,
  };
  return new Response(
    `<html><script type="application/ld+json">${JSON.stringify(posting)}</script></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

test("a matching structured listing with a future expiry is verified open", async () => {
  const result = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () =>
      postingPage({ validThrough: "2026-11-15T23:59:59.000Z" }),
  });

  assert.deepEqual(result, {
    canonicalJobId: "EA:508741",
    status: "open",
    checkedAt: checkedAt.toISOString(),
    source: "official",
    reason: "active_listing",
  });
});

test("a matching structured listing with an expired date is closed", async () => {
  const result = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () =>
      postingPage({ validThrough: "2026-11-07T23:59:59.000Z" }),
  });

  assert.equal(result.status, "closed");
  assert.equal(result.source, "official");
  assert.equal(result.reason, "expired_listing");
});

test("only an official 404 or 410 is treated as an unavailable listing", async () => {
  for (const status of [404, 410]) {
    const result = await checkEaListingAvailability("EA:508741", {
      now: checkedAt,
      fetcher: async () => new Response(null, { status }),
    });

    assert.equal(result.status, "closed");
    assert.equal(result.source, "official");
    assert.equal(result.reason, "listing_not_found");
  }
});

test("generic, mismatched, and undated HTML never establish availability", async () => {
  const generic = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () =>
      new Response("<html><body>Careers at EA</body></html>", {
        headers: { "content-type": "text/html" },
      }),
  });
  const mismatched = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () =>
      postingPage({ id: "508742", validThrough: "2026-11-15T23:59:59.000Z" }),
  });
  const undated = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () => postingPage({ validThrough: undefined }),
  });

  for (const result of [generic, mismatched, undated]) {
    assert.equal(result.status, "unknown");
    assert.equal(result.source, "unknown");
    assert.equal(result.reason, "unverifiable");
  }
});

test("a redirect outside the official host is not followed", async () => {
  const requests = [];
  let redirectBodyCancelled = false;
  const result = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(
        new ReadableStream({
          cancel() {
            redirectBodyCancelled = true;
          },
        }),
        {
          status: 302,
          headers: { location: "https://example.invalid/JobDetail/508741" },
        },
      );
    },
  });

  assert.equal(result.status, "unknown");
  assert.equal(requests.length, 1);
  assert.equal(redirectBodyCancelled, true);
  assert.equal(
    requests[0].url,
    "https://jobs.ea.com/en_US/careers/JobDetail/508741",
  );
  assert.equal(requests[0].init.headers.Authorization, undefined);
});

test("oversized streamed HTML is canceled at the response body cap", async () => {
  let bodyCancelled = false;
  const result = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(600_000));
          },
          cancel() {
            bodyCancelled = true;
          },
        }),
        { headers: { "content-type": "text/html" } },
      ),
  });

  assert.equal(result.status, "unknown");
  assert.equal(bodyCancelled, true);
});

test("network blocks and non-404 errors remain unknown", async () => {
  const responses = [];
  for (const status of [403, 503]) {
    responses.push(
      await checkEaListingAvailability("EA:508741", {
        now: checkedAt,
        fetcher: async () => new Response("Unavailable", { status }),
      }),
    );
  }
  const failed = await checkEaListingAvailability("EA:508741", {
    now: checkedAt,
    fetcher: async () => {
      throw new Error("Proxy connection failed");
    },
  });

  for (const result of responses) assert.equal(result.status, "unknown");
  assert.equal(failed.status, "unknown");
  for (const result of responses) assert.equal(result.source, "unknown");
  assert.equal(failed.source, "unknown");
});

test(
  "a fetch aborts within its configured time budget",
  { timeout: 1_000 },
  async () => {
    let observedAbort = false;
    const result = await checkEaListingAvailability("EA:508741", {
      now: checkedAt,
      timeoutMs: 5,
      fetcher: async (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return reject(new Error("Missing request timeout"));
          const rejectAsAborted = () => {
            observedAbort = true;
            reject(new Error("Request timed out"));
          };
          if (signal.aborted) rejectAsAborted();
          else
            signal.addEventListener("abort", rejectAsAborted, { once: true });
        }),
    });

    assert.equal(observedAbort, true);
    assert.equal(result.status, "unknown");
  },
);

test("the public route validates the canonical ID and returns listing evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    postingPage({ validThrough: "2026-11-15T23:59:59.000Z" });
  try {
    const response = await checkAvailability(
      new Request("https://referral.example.invalid/api/jobs/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canonicalJobId: "EA:508741" }),
      }),
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      {
        ok: body.ok,
        canonicalJobId: body.canonicalJobId,
        status: body.status,
        source: body.source,
        reason: body.reason,
      },
      {
        ok: true,
        canonicalJobId: "EA:508741",
        status: "open",
        source: "official",
        reason: "active_listing",
      },
    );
    assert.equal(Number.isFinite(Date.parse(body.checkedAt)), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the public route rejects unsupported values before an external request", async () => {
  const originalFetch = globalThis.fetch;
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    throw new Error("Should not fetch invalid input");
  };
  try {
    const response = await checkAvailability(
      new Request("https://referral.example.invalid/api/jobs/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canonicalJobId: "https://example.invalid/123" }),
      }),
    );

    assert.equal(response.status, 400);
    assert.equal(requested, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
