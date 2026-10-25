import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseContacts } from "../src/server/files/contracts.ts";
import { PdfDocxParser } from "../src/server/files/parser.ts";

const fixture = (name) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));

test("PDF fixture extracts machine-readable contact fields", async () => {
  const bytes = await fixture("resume-contact.pdf");
  const text = await new PdfDocxParser().extractText(bytes, {
    extension: "pdf",
    contentType: "application/pdf",
  });
  const parsed = parseContacts(text);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.fields.firstName, "Alex");
  assert.equal(parsed.fields.lastName, "Rivera");
  assert.equal(parsed.fields.email, "alex.rivera@example.invalid");
  assert.match(parsed.fields.phone, /555 010 0100/);
});

test("DOCX fixture extracts machine-readable contact fields", async () => {
  const bytes = await fixture("resume-contact.docx");
  const text = await new PdfDocxParser().extractText(bytes, {
    extension: "docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const parsed = parseContacts(text);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.fields.firstName, "Alex");
  assert.equal(parsed.fields.lastName, "Rivera");
  assert.equal(parsed.fields.email, "alex.rivera@example.invalid");
  assert.match(parsed.fields.phone, /555 010 0100/);
});

test("readable PDF without a phone number remains a correction case", async () => {
  const bytes = await fixture("resume-missing-phone.pdf");
  const text = await new PdfDocxParser().extractText(bytes, {
    extension: "pdf",
    contentType: "application/pdf",
  });
  const parsed = parseContacts(text);
  assert.equal(parsed.fields.firstName, "Alex");
  assert.equal(parsed.fields.lastName, "Rivera");
  assert.equal(parsed.fields.email, "alex.rivera@example.invalid");
  assert.equal(parsed.fields.phone, null);
  assert.equal(parsed.ready, false);
});

test("malformed PDF and truncated DOCX fail with a safe parser error", async () => {
  const pdf = new PdfDocxParser();
  await assert.rejects(
    pdf.extractText(Buffer.from("%PDF-1.4\nnot a document"), {
      extension: "pdf",
      contentType: "application/pdf",
    }),
    /could not be safely read/i,
  );
  const docx = new PdfDocxParser();
  await assert.rejects(
    docx.extractText(Buffer.from("PK\x03\x04truncated"), {
      extension: "docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    /could not be safely read/i,
  );
});

test("DOCX expansion limits reject an archive bomb before extracting its text", async () => {
  const bytes = await fixture("resume-archive-bomb.docx");
  await assert.rejects(
    new PdfDocxParser().extractText(bytes, {
      extension: "docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    /could not be safely read/i,
  );
});
