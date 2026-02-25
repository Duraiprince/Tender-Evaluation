/**
 * Unit tests for src/lib/pdf-utils.ts
 *
 * Three scenarios:
 *   1. Text-based PDF page  – extractPdfPage returns text; fingerprint + match work
 *   2. Scanned PDF page     – sparse text triggers OCR; match still works
 *   3. Digitally signed PDF – detectDigitalSignature picks up /Type /Sig bytes
 *
 * Heavy I/O (PDFParse, Tesseract) is mocked so tests run fast without real PDFs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pageFingerprint,
  findBestPageMatch,
  findPagesByTitle,
  detectDigitalSignature,
  detectPhysicalSignatureMarkers,
  ocrIfNeeded,
  ROW_TITLE_PATTERNS,
  type PageData,
} from "@/lib/pdf-utils";

// ── Mock heavy dependencies ───────────────────────────────────────────────────

vi.mock("tesseract.js", () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({
      data: { text: "Authorized Signatory OCR text from scanned page" },
    }),
  },
}));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(_opts: unknown) {}
    static setWorker() {}
    async getText() {
      return { pages: [] };
    }
    async getScreenshot() {
      return { pages: [] };
    }
    async destroy() {}
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Text-based PDF page
// ─────────────────────────────────────────────────────────────────────────────
describe("Scenario 1 – text-based PDF page", () => {
  const richText = `
    8.3 – COMPLIANCE TO BID REQUIREMENTS DEVIATION SHEET
    Tender No: CPCL/2024/001
    Section 3 Technical Specification
    All items complied as per tender document.
    For and on behalf of CETEX Industries Ltd.
    Authorized Signatory
  `;

  it("pageFingerprint produces consistent hash for same text", () => {
    const fp1 = pageFingerprint(richText);
    const fp2 = pageFingerprint(richText);
    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.normalizedTokens.length).toBeGreaterThan(0);
  });

  it("pageFingerprint extracts anchor keywords", () => {
    const fp = pageFingerprint(richText);
    expect(fp.anchorKeywords).toContain("8.3");
    expect(fp.anchorKeywords).toContain("technical specification");
    expect(fp.anchorKeywords).toContain("authorized signatory");
  });

  it("findBestPageMatch returns the page most similar to tender fingerprint", () => {
    const tenderFp = pageFingerprint(richText);

    const bidderPages: PageData[] = [
      {
        pageNumber: 1,
        text: "Unrelated content about shipping and logistics.",
        imageDataUrl: "",
      },
      {
        pageNumber: 2,
        text: `
          8.3 Compliance to Bid Requirements Deviation Sheet
          Section 3 Technical Specification
          Complied. Authorized Signatory – CETEX Industries
        `,
        imageDataUrl: "",
      },
      {
        pageNumber: 3,
        text: "Price schedule and commercial terms.",
        imageDataUrl: "",
      },
    ];

    const candidates = findBestPageMatch(tenderFp, bidderPages);
    expect(candidates[0].pageNumber).toBe(2);
    expect(candidates[0].confidence).toBeGreaterThan(candidates[1].confidence);
  });

  it("detectPhysicalSignatureMarkers finds sign & seal keywords", () => {
    const result = detectPhysicalSignatureMarkers(richText);
    expect(result.detected).toBe(true);
    expect(result.indicators).toContain("authorized signatory");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: Scanned PDF page (sparse text → OCR fallback)
// ─────────────────────────────────────────────────────────────────────────────
describe("Scenario 2 – scanned PDF page (OCR fallback)", () => {
  it("ocrIfNeeded returns original text when it is rich enough", async () => {
    const richText = "A".repeat(60); // above MIN_TEXT_LENGTH = 50
    const result = await ocrIfNeeded(richText, "data:image/png;base64,abc");
    expect(result).toBe(richText);
  });

  it("ocrIfNeeded calls Tesseract when text is sparse", async () => {
    const sparseText = "abc"; // below threshold
    const fakeDataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const result = await ocrIfNeeded(sparseText, fakeDataUrl);
    // Tesseract mock returns "Authorized Signatory OCR text from scanned page"
    expect(result).toContain("Authorized Signatory");
  });

  it("ocrIfNeeded returns sparse text when no imageDataUrl is given", async () => {
    const result = await ocrIfNeeded("xy", "");
    expect(result).toBe("xy");
  });

  it("findBestPageMatch on OCR-enriched pages still finds correct page", () => {
    const tenderText = "section 3 technical specification compliance deviation sheet 8.3";
    const tenderFp = pageFingerprint(tenderText);

    const pages: PageData[] = [
      {
        pageNumber: 10,
        text: "Section 3 Technical Specification Compliance Deviation Sheet 8.3 CETEX",
        imageDataUrl: "",
      },
      { pageNumber: 11, text: "general terms and conditions", imageDataUrl: "" },
    ];

    const [best] = findBestPageMatch(tenderFp, pages);
    expect(best.pageNumber).toBe(10);
    expect(best.confidence).toBeGreaterThan(0.3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2b: findPagesByTitle — NIT section title detection
// ─────────────────────────────────────────────────────────────────────────────
describe("findPagesByTitle — NIT section title detection", () => {
  const pages: PageData[] = [
    {
      pageNumber: 1,
      text: "General Terms and Conditions\nThis document sets out...",
      imageDataUrl: "",
    },
    {
      pageNumber: 2,
      text: "SECTION – 3\nTECHNICAL SPECIFICATION\n\nAll items shall comply with IS standards.",
      imageDataUrl: "",
    },
    {
      pageNumber: 3,
      text: "8.3 - COMPLIANCE TO BID REQUIREMENTS DEVIATION SHEET\nDescription | Tender Spec | Offered Spec",
      imageDataUrl: "",
    },
    {
      pageNumber: 4,
      text: "Section 3 Technical Specification continuation page",
      imageDataUrl: "",
    },
    {
      pageNumber: 5,
      text: "Price schedule and payment terms.",
      imageDataUrl: "",
    },
  ];

  it("finds page with exact em-dash title 'SECTION – 3'", () => {
    const found = findPagesByTitle(pages, ROW_TITLE_PATTERNS[1]);
    const pageNums = found.map((p) => p.pageNumber);
    expect(pageNums).toContain(2);
  });

  it("finds page with hyphen variant 'section - 3'", () => {
    const pagesWithHyphen: PageData[] = [
      {
        pageNumber: 10,
        text: "SECTION - 3\nTechnical Specification\nContent here.",
        imageDataUrl: "",
      },
    ];
    const found = findPagesByTitle(pagesWithHyphen, ROW_TITLE_PATTERNS[1]);
    expect(found.length).toBe(1);
    expect(found[0].pageNumber).toBe(10);
  });

  it("finds deviation sheet page", () => {
    const found = findPagesByTitle(pages, ROW_TITLE_PATTERNS[2]);
    const pageNums = found.map((p) => p.pageNumber);
    expect(pageNums).toContain(3);
  });

  it("returns empty when no page matches", () => {
    const found = findPagesByTitle(pages, ["completely unrelated heading"]);
    expect(found).toHaveLength(0);
  });

  it("does not match title patterns found deep in page body (beyond header zone)", () => {
    const deepMatchPage: PageData[] = [
      {
        pageNumber: 20,
        // Title pattern appears past 600 chars — should NOT match
        text:
          "A".repeat(601) +
          "SECTION – 3 appears here but this is not the title.",
        imageDataUrl: "",
      },
    ];
    const found = findPagesByTitle(deepMatchPage, ROW_TITLE_PATTERNS[1]);
    expect(found).toHaveLength(0);
  });

  it("ROW_TITLE_PATTERNS[1] contains expected section-3 keywords", () => {
    expect(ROW_TITLE_PATTERNS[1]).toContain("section – 3");
    expect(ROW_TITLE_PATTERNS[1]).toContain("technical specification");
  });

  it("ROW_TITLE_PATTERNS[2] contains deviation sheet keyword", () => {
    expect(ROW_TITLE_PATTERNS[2]).toContain(
      "8.3 - compliance to bid requirements deviation sheet"
    );
    expect(ROW_TITLE_PATTERNS[2]).toContain("nil deviation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Digitally signed PDF
// ─────────────────────────────────────────────────────────────────────────────
describe("Scenario 3 – digitally signed PDF", () => {
  /**
   * Build a minimal synthetic PDF buffer that contains the byte sequences
   * used by PDF digital signature dictionaries, so we can test the parser
   * without needing an actual signed PDF file.
   */
  function makeFakeSignedPdfBuffer(signerName?: string, signingDate?: string): Buffer {
    const parts: string[] = [
      "%PDF-1.6\n",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
      "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n",
      // Signature dictionary
      "4 0 obj\n<< /Type /Sig\n",
      "   /SubFilter /adbe.pkcs7.detached\n",
    ];
    if (signerName) parts.push(`   /Name (${signerName})\n`);
    if (signingDate) parts.push(`   /M (D:${signingDate})\n`);
    parts.push(">>\nendobj\n");
    parts.push("xref\n0 5\n");
    parts.push("trailer << /Root 1 0 R /Size 5 >>\n");
    parts.push("%%EOF\n");
    return Buffer.from(parts.join(""), "latin1");
  }

  it("detectDigitalSignature detects /Type /Sig in PDF bytes", () => {
    const buf = makeFakeSignedPdfBuffer("CETEX Industries Ltd", "20240315120000");
    const result = detectDigitalSignature(buf);
    expect(result.detected).toBe(true);
    expect(result.signerName).toBe("CETEX Industries Ltd");
    expect(result.signingTime).toBe("2024-03-15 12:00:00");
    expect(result.validityStatus).toBe("unknown");
  });

  it("detectDigitalSignature returns detected:false for unsigned PDF", () => {
    const plainPdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "latin1");
    const result = detectDigitalSignature(plainPdf);
    expect(result.detected).toBe(false);
    expect(result.signerName).toBeUndefined();
  });

  it("detectDigitalSignature handles ETSI subfilter variant", () => {
    const etsiPdf = Buffer.from(
      "%PDF-1.7\n<< /Type /Sig /SubFilter /ETSI.CAdES.detached >>\n%%EOF\n",
      "latin1"
    );
    const result = detectDigitalSignature(etsiPdf);
    expect(result.detected).toBe(true);
  });

  it("detectPhysicalSignatureMarkers returns false when no markers present", () => {
    const plainText = "This is a plain page with no signatures.";
    const result = detectPhysicalSignatureMarkers(plainText);
    expect(result.detected).toBe(false);
    expect(result.indicators).toHaveLength(0);
  });

  it("detectPhysicalSignatureMarkers detects multiple indicators", () => {
    const text = "Please stamp with company seal. Authorized Signatory: ___________";
    const result = detectPhysicalSignatureMarkers(text);
    expect(result.detected).toBe(true);
    expect(result.indicators).toContain("seal");
    expect(result.indicators).toContain("authorized signatory");
  });
});
