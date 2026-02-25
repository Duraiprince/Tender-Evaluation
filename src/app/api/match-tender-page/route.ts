import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import {
  extractPdfPage,
  extractAllPages,
  ocrIfNeeded,
  pageFingerprint,
  findBestPageMatch,
  detectDigitalSignature,
  detectPhysicalSignatureMarkers,
  type MatchResult,
  type PageMatchCandidate,
  type SignatureInfo,
} from "@/lib/pdf-utils";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: false },
};

// In-memory page index cache: key = `${bidder}:${zipHash}`, value = PageData[]
// This avoids re-scanning the same ZIP on subsequent requests.
const pageIndexCache = new Map<string, import("@/lib/pdf-utils").PageData[]>();

function simpleCacheKey(bidder: string, zipByteLength: number): string {
  return `${bidder}:${zipByteLength}`;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const tenderPdfFile = formData.get("tenderPdf") as File | null;
    const offerZipFile = formData.get("offerZip") as File | null;
    const bidder = formData.get("bidder") as string | null;
    const tenderPageIndexRaw = formData.get("tenderPageIndex") as string | null;

    if (!tenderPdfFile) {
      return NextResponse.json({ error: "No tender PDF provided" }, { status: 400 });
    }
    if (!offerZipFile) {
      return NextResponse.json({ error: "No offer ZIP provided" }, { status: 400 });
    }
    if (!bidder) {
      return NextResponse.json({ error: "No bidder name provided" }, { status: 400 });
    }

    const tenderPageIndex = tenderPageIndexRaw ? parseInt(tenderPageIndexRaw, 10) : 0;
    if (isNaN(tenderPageIndex) || tenderPageIndex < 0) {
      return NextResponse.json({ error: "Invalid tenderPageIndex" }, { status: 400 });
    }

    // ── 1. Extract the reference tender page ──────────────────────────────────
    const tenderBuffer = Buffer.from(await tenderPdfFile.arrayBuffer());
    const tenderPage = await extractPdfPage(tenderBuffer, tenderPageIndex);

    // OCR if the tender page is scanned
    const tenderText = await ocrIfNeeded(tenderPage.text, tenderPage.imageDataUrl);
    const tenderFp = pageFingerprint(tenderText);

    // ── 2. Scan bidder ZIP, collect all pages of every PDF ────────────────────
    const zipBuffer = await offerZipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Find bidder folder inside the ZIP
    const allPaths = Object.keys(zip.files);
    const bidderPrefix = allPaths.find((p) => {
      const parts = p.split("/").filter(Boolean);
      return parts.length >= 2 && parts[1] === bidder;
    });

    if (!bidderPrefix) {
      return NextResponse.json(
        { error: `Bidder folder "${bidder}" not found in ZIP` },
        { status: 404 }
      );
    }

    const rootFolder = bidderPrefix.split("/").filter(Boolean)[0];
    const prefix = `${rootFolder}/${bidder}/`;

    const bidderPdfFiles: { name: string; path: string }[] = [];
    zip.forEach((relativePath, file) => {
      if (
        relativePath.startsWith(prefix) &&
        !file.dir &&
        relativePath.length > prefix.length &&
        getFileExtension(relativePath) === "pdf"
      ) {
        const fileName = relativePath.substring(prefix.length).split("/").pop() ?? "";
        if (fileName) bidderPdfFiles.push({ name: fileName, path: relativePath });
      }
    });

    if (bidderPdfFiles.length === 0) {
      return NextResponse.json(
        { error: `No PDF files found for bidder "${bidder}"` },
        { status: 404 }
      );
    }

    // Use cache when possible
    const cacheKey = simpleCacheKey(bidder, zipBuffer.byteLength);
    let allBidderPages = pageIndexCache.get(cacheKey);

    if (!allBidderPages) {
      allBidderPages = [];
      for (const pdfFile of bidderPdfFiles) {
        const fileData = await zip.file(pdfFile.path)!.async("uint8array");
        const pdfBuffer = Buffer.from(fileData);
        try {
          const pages = await extractAllPages(pdfBuffer);
          // Enrich pages with OCR text and tag with file name
          const enrichedPages = await Promise.all(
            pages.map(async (page) => ({
              ...page,
              text: await ocrIfNeeded(page.text, page.imageDataUrl),
              // Store file name in a separate property for display (we track it via the candidates)
            }))
          );
          // Attach file name info by injecting into pageNumber range tracking
          enrichedPages.forEach((p) => {
            (p as import("@/lib/pdf-utils").PageData & { _docName?: string })._docName = pdfFile.name;
          });
          allBidderPages!.push(...enrichedPages);
        } catch (err) {
          console.error(`[match-tender-page] Error processing ${pdfFile.name}:`, err);
        }
      }
      pageIndexCache.set(cacheKey, allBidderPages);
    }

    // ── 3. Find best matching pages ───────────────────────────────────────────
    const topCandidates = findBestPageMatch(tenderFp, allBidderPages);

    // Attach document names back
    topCandidates.forEach((c) => {
      const pageWithMeta = allBidderPages!.find(
        (p) => p.pageNumber === c.pageData.pageNumber
      ) as (import("@/lib/pdf-utils").PageData & { _docName?: string }) | undefined;
      c.documentName = pageWithMeta?._docName ?? "unknown";
    });

    const bestMatch: PageMatchCandidate | null =
      topCandidates.length > 0 && topCandidates[0].confidence > 0.05
        ? topCandidates[0]
        : null;

    // ── 4. Signature verification on best match ───────────────────────────────
    let signatureInfo: SignatureInfo | null = null;

    if (bestMatch) {
      // Digital signature: scan the whole bidder PDF that contained the match
      const matchDocName = bestMatch.documentName;
      const matchPdfFile = bidderPdfFiles.find((f) => f.name === matchDocName);
      let digitalSig = { detected: false } as import("@/lib/pdf-utils").DigitalSignatureInfo;

      if (matchPdfFile) {
        const fileData = await zip.file(matchPdfFile.path)!.async("uint8array");
        digitalSig = detectDigitalSignature(Buffer.from(fileData));
      }

      // Physical signature: check best-match page text
      const physicalSig = detectPhysicalSignatureMarkers(bestMatch.pageData.text);

      signatureInfo = { digital: digitalSig, physical: physicalSig };
    }

    // ── 5. Determine overall status ───────────────────────────────────────────
    let status: import("@/lib/pdf-utils").MatchStatus = "no_match";

    if (bestMatch && signatureInfo) {
      const hasDigital = signatureInfo.digital.detected;
      const hasPhysical = signatureInfo.physical.detected;

      if (hasDigital && hasPhysical) status = "match_signed_both";
      else if (hasDigital) status = "match_signed_digital";
      else if (hasPhysical) status = "match_signed_physical";
      else status = "match_unsigned";
    }

    const result: MatchResult = {
      status,
      match: bestMatch,
      topCandidates,
      signatureInfo,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[match-tender-page] error:", err);
    return NextResponse.json(
      { error: "Failed to match tender page" },
      { status: 500 }
    );
  }
}
