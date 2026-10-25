// Detect cases where a PDF parser returned a text layer, but the result is
// probably too sparse or noisy to answer questions reliably. Scanned PDFs may
// contain headers or an imperfect hidden OCR layer, so character count alone
// is not enough to decide whether OCR is needed.
export function shouldUsePdfOcr(text, pageCount = 1) {
  const normalized = String(text ?? "").replace(/\u0000/g, "").trim();
  if (normalized.length < 40) return true;

  const parsedPageCount = Number(pageCount);
  const pages = Number.isFinite(parsedPageCount) && parsedPageCount > 0
    ? Math.floor(parsedPageCount)
    : 1;
  const nonWhitespace = normalized.replace(/\s/g, "");
  if (!nonWhitespace.length) return true;

  const alphaNumericCount = (nonWhitespace.match(/[\p{L}\p{N}]/gu) || []).length;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const readableTokens = tokens.filter((token) => /[\p{L}\p{N}]{2,}/u.test(token)).length;

  const alphaNumericRatio = alphaNumericCount / nonWhitespace.length;
  const readableTokenRatio = tokens.length ? readableTokens / tokens.length : 0;
  const charactersPerPage = nonWhitespace.length / pages;

  return (
    charactersPerPage < 70 ||
    alphaNumericRatio < 0.45 ||
    readableTokenRatio < 0.4
  );
}
