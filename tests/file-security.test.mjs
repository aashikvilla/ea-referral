import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { afterEach } from "node:test";

import { HttpMalwareScanner } from "../src/server/files/security.ts";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.FILE_SCANNER_URL;
const originalToken = process.env.FILE_SCANNER_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.FILE_SCANNER_URL;
  else process.env.FILE_SCANNER_URL = originalUrl;
  if (originalToken === undefined) delete process.env.FILE_SCANNER_TOKEN;
  else process.env.FILE_SCANNER_TOKEN = originalToken;
});

test("unconfigured scanner leaves an upload quarantined", async () => {
  delete process.env.FILE_SCANNER_URL;
  const result = await new HttpMalwareScanner().scan(
    Buffer.from("fixture bytes"),
    "resume.pdf",
    "application/pdf",
  );
  assert.deepEqual(result, { status: "quarantined" });
});

test("scanner network failure fails closed to quarantine", async () => {
  process.env.FILE_SCANNER_URL = "https://scanner.example.invalid/scan";
  globalThis.fetch = async () => {
    throw new Error("scanner offline");
  };
  const result = await new HttpMalwareScanner().scan(
    Buffer.from("fixture bytes"),
    "resume.pdf",
    "application/pdf",
  );
  assert.deepEqual(result, { status: "quarantined" });
});

test("scanner only accepts a signed-by-content result for the uploaded bytes", async () => {
  process.env.FILE_SCANNER_URL = "https://scanner.example.invalid/scan";
  const bytes = Buffer.from("fixture bytes");
  const digest = createHash("sha256").update(bytes).digest("hex");
  let sentDigest = "";
  globalThis.fetch = async (_input, init = {}) => {
    sentDigest = new Headers(init.headers).get("X-File-SHA256") ?? "";
    return Response.json({ sha256: "wrong-content", status: "clean" });
  };
  assert.deepEqual(
    await new HttpMalwareScanner().scan(bytes, "resume.pdf", "application/pdf"),
    { status: "quarantined" },
  );
  assert.equal(sentDigest, digest);
});
