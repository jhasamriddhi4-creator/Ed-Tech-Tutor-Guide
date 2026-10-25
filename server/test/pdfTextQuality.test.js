import test from "node:test";
import assert from "node:assert/strict";
import { shouldUsePdfOcr } from "../src/services/pdfTextQuality.js";

test("uses OCR when PDF text extraction returns almost no text", () => {
  assert.equal(shouldUsePdfOcr(""), true);
  assert.equal(shouldUsePdfOcr("only a few words"), true);
});

test("uses OCR when a multipage PDF has only a sparse text layer", () => {
  assert.equal(shouldUsePdfOcr("Course title\nPage 1\nPage 2", 12), true);
});

test("uses OCR when extracted text looks garbled", () => {
  assert.equal(shouldUsePdfOcr("§¤§¤ ^^^ /// §¤§¤ *** ### ~~~", 1), true);
});

test("keeps readable text-based PDF content on the fast path", () => {
  const text = Array.from({ length: 12 }, (_, index) =>
    `Page ${index + 1}: Operating systems manage computer hardware and software resources. Processes execute instructions, share system resources, and use memory safely. The scheduler selects a process for CPU execution.`
  ).join("\n");
  assert.equal(shouldUsePdfOcr(text, 12), false);
});
