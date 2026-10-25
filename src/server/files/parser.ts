import "server-only";
import { inflateRawSync, inflateSync } from "node:zlib";
import { ApiError } from "@/server/http";
import type { SupportedDocument } from "@/server/files/contracts";

const MAX_DOCX_ENTRIES = 250;
const MAX_ARCHIVE_EXPANDED_BYTES = 8 * 1024 * 1024;
const MAX_PDF_STREAM_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 1_000_000;
const PDF_MAX_PAGES = 40;

export interface DocumentParser {
  extractText(bytes: Uint8Array, document: SupportedDocument): Promise<string>;
}

type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  crc: number;
  compressedSize: number;
  expandedSize: number;
  localOffset: number;
};

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntries(archive: Buffer): ZipEntry[] {
  const minOffset = Math.max(0, archive.length - 65_557);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= minOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0 || eocd + 22 > archive.length)
    throw new Error("DOCX ZIP directory is missing");
  const disk = archive.readUInt16LE(eocd + 4);
  const directoryDisk = archive.readUInt16LE(eocd + 6);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const directorySize = archive.readUInt32LE(eocd + 12);
  const directoryOffset = archive.readUInt32LE(eocd + 16);
  const commentLength = archive.readUInt16LE(eocd + 20);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount > MAX_DOCX_ENTRIES ||
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    eocd + 22 + commentLength !== archive.length ||
    directoryOffset + directorySize > eocd
  )
    throw new Error("DOCX archive exceeds safe processing limits");

  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  let totalExpanded = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > archive.length ||
      archive.readUInt32LE(offset) !== 0x02014b50
    )
      throw new Error("DOCX directory entry is invalid");
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const crc = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const expandedSize = archive.readUInt32LE(offset + 24);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const entryCommentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const end = offset + 46 + fileNameLength + extraLength + entryCommentLength;
    if (
      end > archive.length ||
      compressedSize === 0xffffffff ||
      expandedSize === 0xffffffff ||
      localOffset === 0xffffffff
    )
      throw new Error("DOCX archive uses unsupported ZIP64 entries");
    const nameBytes = archive.subarray(
      offset + 46,
      offset + 46 + fileNameLength,
    );
    const name = nameBytes.toString((flags & 0x0800) !== 0 ? "utf8" : "latin1");
    const ratio = compressedSize > 0 ? expandedSize / compressedSize : Infinity;
    totalExpanded += expandedSize;
    if (
      totalExpanded > MAX_ARCHIVE_EXPANDED_BYTES ||
      (expandedSize > 0 && compressedSize === 0) ||
      ratio > 1000 ||
      (flags & 0x0001) !== 0 ||
      (flags & 0x0040) !== 0 ||
      ![0, 8].includes(method) ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..")
    )
      throw new Error("DOCX archive exceeds safe processing limits");
    entries.push({
      name,
      flags,
      method,
      crc,
      compressedSize,
      expandedSize,
      localOffset,
    });
    offset = end;
  }
  if (offset !== directoryOffset + directorySize)
    throw new Error("DOCX directory size is invalid");
  return entries;
}

function inflateZipEntry(archive: Buffer, entry: ZipEntry): Buffer {
  const offset = entry.localOffset;
  if (
    offset + 30 > archive.length ||
    archive.readUInt32LE(offset) !== 0x04034b50
  )
    throw new Error("DOCX local entry is invalid");
  const localFlags = archive.readUInt16LE(offset + 6);
  const localMethod = archive.readUInt16LE(offset + 8);
  const fileNameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const localName = archive
    .subarray(offset + 30, offset + 30 + fileNameLength)
    .toString((localFlags & 0x0800) !== 0 ? "utf8" : "latin1");
  if (
    (localFlags & 0x0001) !== 0 ||
    localMethod !== entry.method ||
    localName !== entry.name
  )
    throw new Error("DOCX local entry flags are invalid");
  const start = offset + 30 + fileNameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > archive.length || entry.expandedSize > MAX_ARCHIVE_EXPANDED_BYTES)
    throw new Error("DOCX entry exceeds safe processing limits");
  const compressed = archive.subarray(start, end);
  const output =
    entry.method === 0
      ? Buffer.from(compressed)
      : inflateRawSync(compressed, {
          maxOutputLength: MAX_ARCHIVE_EXPANDED_BYTES,
        });
  if (output.length !== entry.expandedSize || crc32(output) !== entry.crc)
    throw new Error("DOCX entry integrity check failed");
  return output;
}

function xmlText(xml: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("DOCX XML declarations are not allowed");
  const withLineBreaks = xml
    .replace(/<w:p(?:\s[^>]*)?>/g, "\n")
    .replace(/<w:br(?:\s[^>]*)?\/?\s*>/g, "\n")
    .replace(/<w:tab(?:\s[^>]*)?\/?\s*>/g, "\t")
    .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<[^>]*>/g, " ");
  return withLineBreaks
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .slice(0, MAX_TEXT_CHARS);
}

function decodeDocx(bytes: Uint8Array): string {
  const archive = Buffer.from(bytes);
  const entries = zipEntries(archive);
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX document XML is missing");
  return xmlText(
    new TextDecoder("utf-8", { fatal: true }).decode(
      inflateZipEntry(archive, document),
    ),
  );
}

function decodePdfString(value: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (char !== "\\") {
      bytes.push(char.charCodeAt(0) & 0xff);
      continue;
    }
    const next = value[index + 1] ?? "";
    if (/[0-7]/.test(next)) {
      const digits =
        value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      bytes.push(parseInt(digits, 8) & 0xff);
      index += digits.length;
    } else if (next === "n") {
      bytes.push(10);
      index += 1;
    } else if (next === "r") {
      bytes.push(13);
      index += 1;
    } else if (next === "t") {
      bytes.push(9);
      index += 1;
    } else if (next === "b") {
      bytes.push(8);
      index += 1;
    } else if (next === "f") {
      bytes.push(12);
      index += 1;
    } else if (next === "\r" || next === "\n") {
      if (next === "\r" && value[index + 2] === "\n") index += 1;
      index += 1;
    } else {
      bytes.push(next.charCodeAt(0) & 0xff);
      index += 1;
    }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let decoded = "";
    for (let index = 2; index + 1 < bytes.length; index += 2)
      decoded += String.fromCharCode(
        ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0),
      );
    return decoded;
  }
  return Buffer.from(bytes).toString("latin1");
}

function decodePdfHex(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  const padded = cleaned.length % 2 ? `${cleaned}0` : cleaned;
  const bytes = Buffer.from(padded, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let decoded = "";
    for (let index = 2; index + 1 < bytes.length; index += 2)
      decoded += String.fromCharCode(
        (bytes[index] ?? 0) * 256 + (bytes[index + 1] ?? 0),
      );
    return decoded;
  }
  return bytes.toString("latin1");
}

function extractTextBlock(block: string): string {
  const lines: string[] = [];
  for (const line of block.split(/(?:T\*|\b(?:Td|TD)\b|\s')/)) {
    const strings = /\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g;
    const parts: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = strings.exec(line)) !== null) {
      const value =
        match[1] !== undefined
          ? decodePdfString(match[1])
          : decodePdfHex(match[2] ?? "");
      if (value) parts.push(value);
    }
    const content = parts.join(" ").trim();
    if (content) lines.push(content);
  }
  return lines.join("\n");
}

function pdfStreams(bytes: Uint8Array): Buffer[] {
  const source = Buffer.from(bytes);
  const sourceText = source.toString("latin1");
  const streams: Buffer[] = [];
  let totalExpanded = 0;
  const marker = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(sourceText)) !== null) {
    const start = marker.lastIndex;
    const end = sourceText.indexOf("endstream", start);
    if (end < 0) throw new Error("PDF stream is truncated");
    const preceding = sourceText.slice(
      Math.max(0, match.index - 2048),
      match.index,
    );
    const rawEnd =
      end > start && sourceText[end - 1] === "\n"
        ? end - (sourceText[end - 2] === "\r" ? 2 : 1)
        : end;
    const streamBytes = source.subarray(start, rawEnd);
    let decoded: Buffer | null = null;
    if (
      /\/Filter\b/.test(preceding) &&
      !/\/Filter\s*\/FlateDecode\b/.test(preceding)
    ) {
      throw new Error("PDF stream uses an unsupported filter");
    }
    if (/\/FlateDecode\b/.test(preceding)) {
      try {
        decoded = inflateSync(streamBytes, {
          maxOutputLength: MAX_PDF_STREAM_BYTES,
        });
      } catch {
        decoded = null;
      }
    } else if (!/\/Filter\b/.test(preceding)) {
      decoded = Buffer.from(streamBytes);
    }
    if (decoded) {
      totalExpanded += decoded.length;
      if (
        decoded.length > MAX_PDF_STREAM_BYTES ||
        totalExpanded > MAX_PDF_STREAM_BYTES
      )
        throw new Error("PDF expanded content exceeds safe processing limits");
      streams.push(decoded);
    }
    marker.lastIndex = end + "endstream".length;
  }
  return streams;
}

function decodePdf(bytes: Uint8Array): string {
  const source = Buffer.from(bytes).toString("latin1");
  const standardType1Fonts =
    "Courier|Courier-Bold|Courier-Oblique|Courier-BoldOblique|Helvetica|Helvetica-Bold|Helvetica-Oblique|Helvetica-BoldOblique|Times-Roman|Times-Bold|Times-Italic|Times-BoldItalic|Symbol|ZapfDingbats";
  const fontCount = [...source.matchAll(/\/Type\s*\/Font\b/g)].length;
  const baseFonts = [...source.matchAll(/\/BaseFont\s*\/([^\s/<>()]+)/g)];
  if (
    !/^%PDF-(?:1\.[0-7]|2\.0)(?:\r?\n|\r)/.test(source) ||
    !/\/Type\s*\/Catalog\b/.test(source) ||
    !/\/Type\s*\/Pages\b/.test(source) ||
    !/\/Type\s*\/Page\b/.test(source) ||
    !/\/Root\s+\d+\s+\d+\s+R\b/.test(source) ||
    !/startxref\s+\d+\s+%%EOF\s*$/.test(source) ||
    /\/Encrypt\b|\/ObjStm\b|\/XRef\b|\/ToUnicode\b|\/Differences\b/.test(
      source,
    ) ||
    fontCount === 0 ||
    baseFonts.length !== fontCount ||
    /\/Subtype\s*\/(?:Type0|Type3|TrueType|CIDFontType\d+)\b/.test(source) ||
    baseFonts.some(
      (match) =>
        !new RegExp(`^(?:${standardType1Fonts})$`).test(match[1] ?? ""),
    ) ||
    [...source.matchAll(/\/Encoding\s*\/([^\s/<>()]+)/g)].some(
      (match) =>
        !/^(?:StandardEncoding|WinAnsiEncoding|MacRomanEncoding)$/.test(
          match[1] ?? "",
        ),
    )
  )
    throw new Error("PDF structure is invalid or unsupported");
  const pages = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pages > PDF_MAX_PAGES)
    throw new Error("PDF page count exceeds safe processing limits");
  const output: string[] = [];
  let total = 0;
  for (const stream of pdfStreams(bytes)) {
    const streamText = stream.toString("latin1");
    const blocks = /\bBT\b([\s\S]*?)\bET\b/g;
    let block: RegExpExecArray | null;
    while ((block = blocks.exec(streamText)) !== null) {
      const extracted = extractTextBlock(block[1] ?? "");
      if (extracted) {
        total += extracted.length;
        if (total > MAX_TEXT_CHARS)
          throw new Error("PDF text exceeds safe processing limits");
        output.push(extracted);
      }
    }
  }
  return output.join("\n");
}

export class PdfDocxParser implements DocumentParser {
  async extractText(
    bytes: Uint8Array,
    document: SupportedDocument,
  ): Promise<string> {
    try {
      const output =
        document.extension === "docx" ? decodeDocx(bytes) : decodePdf(bytes);
      return output.slice(0, MAX_TEXT_CHARS);
    } catch {
      throw new ApiError(
        422,
        "invalid_request",
        "The resume could not be safely read. Upload a text-based PDF or DOCX.",
      );
    }
  }
}
