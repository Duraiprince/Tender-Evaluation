import { createHash } from "crypto";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageData {
  pageNumber: number; // 1-based
  text: string;
  imageDataUrl: string;
}

export interface PageFingerprint {
  hash: string;
  normalizedTokens: string[];
  headingLines: string[];
  anchorKeywords: string[];
}

export interface PageMatchCandidate {
  documentName: string;
  pageNumber: number;
  confidence: number; // 0–1
  pageData: PageData;
}

export interface DigitalSignatureInfo {
  detected: boolean;
  signerName?: string;
  signingTime?: string;
  validityStatus?: "valid" | "invalid" | "unknown";
}

export interface PhysicalSignatureInfo {
  detected: boolean;
  indicators: string[];
}

export interface SignatureInfo {
  digital: DigitalSignatureInfo;
  physical: PhysicalSignatureInfo;
}

export type MatchStatus =
  | "match_signed_digital"
  | "match_signed_physical"
  | "match_signed_both"
  | "match_unsigned"
  | "no_match";

export interface MatchResult {
  status: MatchStatus;
  match: PageMatchCandidate | null;
  topCandidates: PageMatchCandidate[];
  signatureInfo: SignatureInfo | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_TEXT_LENGTH = 50;

const PHYSICAL_SIGNATURE_MARKERS = [
  "authorized signatory",
  "authorised signatory",
  "signature",
  "sign & seal",
  "sign and seal",
  "signed & sealed",
  "signed and sealed",
  "seal",
  "stamp",
  "for and on behalf",
  "for cetex",
  "for and behalf",
  "company seal",
  "official seal",
  "rubber stamp",
  "wet signature",
];

// ─── 1. extractPdfPage ────────────────────────────────────────────────────────

/**
 * Extract text and a rendered image from a single page of a PDF.
 * pageIndex is 0-based (page 67 → pageIndex 66).
 */
export async function extractPdfPage(
  pdfBuffer: Buffer,
  pageIndex: number
): Promise<PageData> {
  const pageNum = pageIndex + 1; // pdfjs is 1-based
  PDFParse.setWorker();
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const textResult = await parser.getText();
    const page = textResult.pages.find((p: { num: number; text: string }) => p.num === pageNum);
    const rawText = page?.text ?? "";

    const screenshots = await parser.getScreenshot({
      partial: [pageNum],
      imageDataUrl: true,
      imageBuffer: false,
      scale: 1.5,
    });

    const imageDataUrl: string = screenshots.pages[0]?.dataUrl ?? "";

    return { pageNumber: pageNum, text: rawText, imageDataUrl };
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract all pages from a PDF as PageData[].
 */
export async function extractAllPages(pdfBuffer: Buffer): Promise<PageData[]> {
  PDFParse.setWorker();
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const textResult = await parser.getText();
    const allPageNums = textResult.pages.map((p: { num: number }) => p.num);

    const screenshots = await parser.getScreenshot({
      partial: allPageNums,
      imageDataUrl: true,
      imageBuffer: false,
      scale: 1.5,
    });

    const shotMap = new Map<number, string>();
    for (const shot of screenshots.pages) {
      shotMap.set(shot.pageNumber, shot.dataUrl);
    }

    return textResult.pages.map((p: { num: number; text: string }) => ({
      pageNumber: p.num,
      text: p.text,
      imageDataUrl: shotMap.get(p.num) ?? "",
    }));
  } finally {
    await parser.destroy();
  }
}

// ─── 2. ocrIfNeeded ───────────────────────────────────────────────────────────

/**
 * If the extracted text is too sparse (likely a scanned page), run Tesseract
 * OCR on the rendered page image and return the OCR text instead.
 */
export async function ocrIfNeeded(
  pageText: string,
  imageDataUrl: string
): Promise<string> {
  if (pageText.trim().length >= MIN_TEXT_LENGTH) return pageText;
  if (!imageDataUrl) return pageText;

  try {
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const {
      data: { text },
    } = await Tesseract.recognize(buffer, "eng");
    return text;
  } catch {
    return pageText;
  }
}

// ─── 3. pageFingerprint ───────────────────────────────────────────────────────

/**
 * Produce a stable fingerprint for a page: a SHA-256 hash of its normalized
 * text, the top token set, detected heading lines, and anchor keywords.
 */
export function pageFingerprint(
  text: string,
  extraHeadings?: string[]
): PageFingerprint {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const headingLines = extractHeadingLines(text, extraHeadings);
  const anchorKeywords = extractAnchorKeywords(text);

  const hashInput = [normalized.slice(0, 500), ...headingLines].join("|");
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return { hash, normalizedTokens: tokens, headingLines, anchorKeywords };
}

// ─── 4. findBestPageMatch ─────────────────────────────────────────────────────

/**
 * Compare a tender page fingerprint against every page in the bidder document
 * and return the top 3 candidates sorted by descending confidence score.
 *
 * Score = 0.6 × Jaccard(text tokens) + 0.4 × anchorCoverage
 */
export function findBestPageMatch(
  tenderFingerprint: PageFingerprint,
  bidderPages: PageData[]
): PageMatchCandidate[] {
  const tenderTokenSet = new Set(tenderFingerprint.normalizedTokens);
  const tenderAnchors = tenderFingerprint.anchorKeywords.map((k) =>
    k.toLowerCase()
  );

  const scored: PageMatchCandidate[] = bidderPages.map((page) => {
    const bidderTokens = new Set(tokenize(normalizeText(page.text)));
    const jaccard = jaccardSimilarity(tenderTokenSet, bidderTokens);

    const bidderLower = page.text.toLowerCase();
    const anchorHits = tenderAnchors.filter((a) => bidderLower.includes(a)).length;
    const anchorCoverage =
      tenderAnchors.length > 0 ? anchorHits / tenderAnchors.length : 0;

    const confidence = Math.min(1, 0.6 * jaccard + 0.4 * anchorCoverage);

    return {
      documentName: "",
      pageNumber: page.pageNumber,
      confidence,
      pageData: page,
    };
  });

  return scored
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// ─── 5. detectDigitalSignature ────────────────────────────────────────────────

/**
 * Scan the raw PDF bytes for cryptographic signature dictionaries
 * (/Type /Sig entries used by PDF AES/PKCS#7 signatures).
 *
 * Note: full certificate chain validation is not performed; validity is
 * reported as "unknown" unless the PDF explicitly signals it.
 */
export function detectDigitalSignature(pdfBuffer: Buffer): DigitalSignatureInfo {
  // Use latin1 so every byte maps 1-to-1 and regex over multi-byte sequences
  // works predictably.
  const content = pdfBuffer.toString("latin1");

  const hasSigType = /\/Type\s*\/Sig/.test(content);
  const hasSigSubfilter =
    /\/SubFilter\s*\/adbe\.pkcs7/i.test(content) ||
    /\/SubFilter\s*\/ETSI\.CAdES/i.test(content) ||
    /\/SubFilter\s*\/adbe\.x509\.rsa/i.test(content);

  if (!hasSigType && !hasSigSubfilter) {
    return { detected: false };
  }

  // Try to pull a human-readable signer name from /Name (...)
  const nameMatch = content.match(/\/Name\s*\(([^\)]{1,120})\)/);
  const signerName = nameMatch ? cleanPdfString(nameMatch[1]) : undefined;

  // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
  const timeMatch = content.match(/\/M\s*\(D:(\d{14})/);
  let signingTime: string | undefined;
  if (timeMatch) {
    const t = timeMatch[1];
    signingTime = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`;
  }

  return {
    detected: true,
    signerName,
    signingTime,
    validityStatus: "unknown",
  };
}

// ─── 6. detectPhysicalSignatureMarkers ───────────────────────────────────────

/**
 * Search for textual markers that indicate a physical (handwritten/stamp)
 * signature or company seal on the page.
 */
export function detectPhysicalSignatureMarkers(
  pageText: string
): PhysicalSignatureInfo {
  const lower = pageText.toLowerCase();
  const found = PHYSICAL_SIGNATURE_MARKERS.filter((marker) =>
    lower.includes(marker)
  );

  return {
    detected: found.length > 0,
    indicators: found,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalizedText: string): string[] {
  return normalizedText
    .split(" ")
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  setA.forEach((t) => { if (setB.has(t)) intersectionCount++; });
  const unionSize = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionSize;
}

function extractHeadingLines(text: string, extras?: string[]): string[] {
  const lines = text.split(/\r?\n/);
  const headings = lines
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 3 &&
        l.length < 100 &&
        // All-caps lines or lines starting with a digit (section numbering)
        (/^[A-Z0-9][A-Z0-9\s\-\.\/&()]{3,}$/.test(l) ||
          /^\d+[\.\d]*\s+\S/.test(l))
    )
    .slice(0, 8);

  return extras ? [...new Set([...headings, ...extras])] : headings;
}

function extractAnchorKeywords(text: string): string[] {
  const anchors: string[] = [];
  // Section numbers like 8.3, 3.1.2
  const sectionNums = text.match(/\b\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\b/g) ?? [];
  anchors.push(...sectionNums);
  // Tender-specific phrases
  const phrases = [
    "technical specification",
    "deviation sheet",
    "compliance to bid requirements",
    "nil deviation",
    "sign & seal",
    "authorized signatory",
    "section-3",
    "section 3",
    "8.3",
  ];
  const lower = text.toLowerCase();
  phrases.forEach((p) => { if (lower.includes(p)) anchors.push(p); });
  return [...new Set(anchors)];
}

function cleanPdfString(raw: string): string {
  return raw.replace(/[^\x20-\x7E]/g, "").trim();
}
