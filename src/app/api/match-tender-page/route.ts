import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import {
  extractAllPages,
  findPagesByTitle,
  ocrIfNeeded,
  pageFingerprint,
  findBestPageMatch,
  detectDigitalSignature,
  detectPhysicalSignatureMarkers,
  ROW_TITLE_PATTERNS,
  type PageData,
  type MatchResult,
  type PageMatchCandidate,
  type SignatureInfo,
} from "@/lib/pdf-utils";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: false },
};

// ── Page index cache ──────────────────────────────────────────────────────────
// Avoids re-scanning the same bidder ZIP on subsequent requests.
// Key: `${bidder}:${zipByteLength}` — simple but effective for the session.
const bidderPageCache = new Map<
  string,
  Array<PageData & { _docName: string }>
>();

function bidderCacheKey(bidder: string, zipByteLength: number): string {
  return `${bidder}:${zipByteLength}`;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// ── Extract all PDF pages from a ZIP file ─────────────────────────────────────
async function extractPagesFromZip(
  zipBuffer: ArrayBuffer,
  folderPrefix?: string
): Promise<Array<PageData & { _docName: string }>> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const allPages: Array<PageData & { _docName: string }> = [];

  const pdfEntries: { name: string; path: string }[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    if (getFileExtension(relativePath) !== "pdf") return;
    if (folderPrefix && !relativePath.startsWith(folderPrefix)) return;
    const fileName = relativePath.split("/").pop() ?? relativePath;
    pdfEntries.push({ name: fileName, path: relativePath });
  });

  for (const entry of pdfEntries) {
    try {
      const fileData = await zip.file(entry.path)!.async("uint8array");
      const pages = await extractAllPages(Buffer.from(fileData));
      for (const page of pages) {
        const text = await ocrIfNeeded(page.text, page.imageDataUrl);
        allPages.push({ ...page, text, _docName: entry.name });
      }
    } catch (err) {
      console.error(`[match-tender-page] Failed to extract ${entry.path}:`, err);
    }
  }

  return allPages;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const nitZipFile = formData.get("nitZip") as File | null;
    const offerZipFile = formData.get("offerZip") as File | null;
    const bidder = formData.get("bidder") as string | null;
    const rowIdRaw = formData.get("rowId") as string | null;

    if (!offerZipFile) {
      return NextResponse.json({ error: "No bidder offer ZIP provided" }, { status: 400 });
    }
    if (!bidder) {
      return NextResponse.json({ error: "No bidder name provided" }, { status: 400 });
    }

    const rowId = rowIdRaw ? parseInt(rowIdRaw, 10) : 1;
    const titlePatterns = ROW_TITLE_PATTERNS[rowId] ?? ROW_TITLE_PATTERNS[1];

    // ── 1. Find reference page(s) from tender/NIT document ───────────────────
    let tenderPages: PageData[] = [];
    let tenderPageRef: (PageData & { _docName: string }) | null = null;

    if (nitZipFile) {
      const nitBuffer = await nitZipFile.arrayBuffer();
      const nitAllPages = await extractPagesFromZip(nitBuffer);

      // Find pages in the NIT document that match the target section title
      const matchedNitPages = findPagesByTitle(nitAllPages, titlePatterns);

      if (matchedNitPages.length > 0) {
        // Use the first matching page as the reference
        const first = matchedNitPages[0] as PageData & { _docName: string };
        tenderPageRef = first;
        tenderPages = matchedNitPages;
      }
    }

    // ── 2. Scan bidder offers ZIP ─────────────────────────────────────────────
    const offerBuffer = await offerZipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(offerBuffer);

    // Locate the bidder's folder inside the ZIP
    const allPaths = Object.keys(zip.files);
    const bidderEntry = allPaths.find((p) => {
      const parts = p.split("/").filter(Boolean);
      return parts.length >= 2 && parts[1] === bidder;
    });

    if (!bidderEntry) {
      return NextResponse.json(
        { error: `Bidder folder "${bidder}" not found in offer ZIP` },
        { status: 404 }
      );
    }

    const rootFolder = bidderEntry.split("/").filter(Boolean)[0];
    const bidderPrefix = `${rootFolder}/${bidder}/`;

    // Use cache when possible
    const cacheKey = bidderCacheKey(bidder, offerBuffer.byteLength);
    let bidderPages = bidderPageCache.get(cacheKey);

    if (!bidderPages) {
      bidderPages = await extractPagesFromZip(offerBuffer, bidderPrefix);
      bidderPageCache.set(cacheKey, bidderPages);
    }

    if (bidderPages.length === 0) {
      return NextResponse.json(
        { error: `No PDF pages found for bidder "${bidder}"` },
        { status: 404 }
      );
    }

    // ── 3. Find best matching bidder page ─────────────────────────────────────
    let topCandidates: PageMatchCandidate[] = [];

    if (tenderPageRef) {
      // Fingerprint-based matching: use the NIT page as reference
      const fp = pageFingerprint(tenderPageRef.text);
      topCandidates = findBestPageMatch(fp, bidderPages);
    } else {
      // Fallback: keyword search when NIT zip is not provided
      const fp = pageFingerprint(titlePatterns.join(" "));
      topCandidates = findBestPageMatch(fp, bidderPages);
    }

    // Attach document names to candidates
    topCandidates.forEach((c) => {
      const match = bidderPages!.find(
        (p) => p.pageNumber === c.pageData.pageNumber && p._docName === (c.pageData as PageData & { _docName?: string })._docName
      );
      c.documentName = match?._docName ?? c.documentName;
    });

    const MIN_CONFIDENCE = 0.05;
    const bestMatch: PageMatchCandidate | null =
      topCandidates.length > 0 && topCandidates[0].confidence > MIN_CONFIDENCE
        ? topCandidates[0]
        : null;

    // ── 4. Signature detection on best match ──────────────────────────────────
    let signatureInfo: SignatureInfo | null = null;

    if (bestMatch) {
      // Digital: scan the whole PDF that contained the matched page
      const matchDocName = bestMatch.documentName;
      let digitalSig: import("@/lib/pdf-utils").DigitalSignatureInfo = { detected: false };

      const matchEntry = allPaths.find((p) => p.endsWith(matchDocName));
      if (matchEntry) {
        const fileData = await zip.file(matchEntry)?.async("uint8array");
        if (fileData) {
          digitalSig = detectDigitalSignature(Buffer.from(fileData));
        }
      }

      // Physical: check page text for signature/seal markers
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

    const result: MatchResult & {
      tenderPage: { pageNumber: number; documentName: string; imageDataUrl: string; text: string } | null;
    } = {
      status,
      match: bestMatch,
      topCandidates,
      signatureInfo,
      tenderPage: tenderPageRef
        ? {
            pageNumber: tenderPageRef.pageNumber,
            documentName: tenderPageRef._docName,
            imageDataUrl: tenderPageRef.imageDataUrl,
            text: tenderPageRef.text,
          }
        : null,
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
