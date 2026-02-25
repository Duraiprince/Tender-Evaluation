import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";

export const maxDuration = 120;

export const config = {
  api: { bodyParser: false },
};

interface SearchCriterion {
  rowId: number;
  primary: string;
  primaryAlt: string[];
  secondary: string;
  secondaryAlt: string[];
}

interface MatchResult {
  rowId: number;
  bidder: string;
  documentName: string;
  pageNumber: number;
  fileType: string;
  imageDataUrl: string;
  pageText: string;
}

const CRITERIA: SearchCriterion[] = [
  {
    rowId: 1,
    primary: "section-3 of tender document",
    primaryAlt: ["section-3", "section 3", "tender document"],
    secondary: "sign & seal",
    secondaryAlt: ["sign", "seal", "sign&seal", "signed", "sealed"],
  },
  {
    rowId: 2,
    primary: "8.3 - compliance to bid requirements deviation sheet of tender document",
    primaryAlt: [
      "compliance to bid requirements",
      "deviation sheet",
      "8.3",
    ],
    secondary: "sign & seal",
    secondaryAlt: ["sign", "seal", "sign&seal", "signed", "sealed"],
  },
];

function textMatchesPrimary(text: string, criterion: SearchCriterion): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(criterion.primary)) return true;
  return criterion.primaryAlt.every((kw) => lower.includes(kw));
}

function textMatchesSecondary(text: string, criterion: SearchCriterion): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(criterion.secondary)) return true;
  return criterion.secondaryAlt.filter((kw) => lower.includes(kw)).length >= 2;
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function processPdf(
  data: Uint8Array,
  bidder: string,
  docName: string
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  PDFParse.setWorker();
  const parser = new PDFParse({ data });

  try {
    const textResult = await parser.getText();

    // Check all criteria against all pages, collect matched pages per criterion
    const matchesByCriterion = new Map<number, number[]>();
    const pageTextMap = new Map<number, string>();

    for (const page of textResult.pages) {
      pageTextMap.set(page.num, page.text);
    }

    for (const criterion of CRITERIA) {
      const matchedPages: number[] = [];
      for (const page of textResult.pages) {
        if (
          textMatchesPrimary(page.text, criterion) &&
          textMatchesSecondary(page.text, criterion)
        ) {
          matchedPages.push(page.num);
        }
      }
      if (matchedPages.length > 0) {
        matchesByCriterion.set(criterion.rowId, matchedPages);
      }
    }

    // Collect all unique pages that need screenshots
    const allPages = new Set<number>();
    for (const pages of matchesByCriterion.values()) {
      for (const p of pages) allPages.add(p);
    }

    if (allPages.size > 0) {
      const screenshots = await parser.getScreenshot({
        partial: Array.from(allPages).sort((a, b) => a - b),
        imageDataUrl: true,
        imageBuffer: false,
        scale: 1.5,
      });

      const shotMap = new Map<number, string>();
      for (const shot of screenshots.pages) {
        shotMap.set(shot.pageNumber, shot.dataUrl);
      }

      for (const [rowId, pages] of matchesByCriterion.entries()) {
        for (const pageNum of pages) {
          results.push({
            rowId,
            bidder,
            documentName: docName,
            pageNumber: pageNum,
            fileType: "pdf",
            imageDataUrl: shotMap.get(pageNum) ?? "",
            pageText: pageTextMap.get(pageNum) ?? "",
          });
        }
      }
    }
  } finally {
    await parser.destroy();
  }

  return results;
}

async function processDocx(
  data: Buffer,
  bidder: string,
  docName: string
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const { value: text } = await mammoth.extractRawText({ buffer: data });

  for (const criterion of CRITERIA) {
    if (
      textMatchesPrimary(text, criterion) &&
      textMatchesSecondary(text, criterion)
    ) {
      results.push({
        rowId: criterion.rowId,
        bidder,
        documentName: docName,
        pageNumber: 1,
        fileType: "docx",
        imageDataUrl: "",
        pageText: text,
      });
    }
  }

  return results;
}

async function processImage(
  data: Uint8Array,
  bidder: string,
  docName: string,
  ext: string
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    tiff: "image/tiff",
    tif: "image/tiff",
    bmp: "image/bmp",
  };
  const mime = mimeMap[ext] ?? "image/png";

  const {
    data: { text },
  } = await Tesseract.recognize(Buffer.from(data), "eng");

  for (const criterion of CRITERIA) {
    if (
      textMatchesPrimary(text, criterion) &&
      textMatchesSecondary(text, criterion)
    ) {
      const base64 = Buffer.from(data).toString("base64");
      results.push({
        rowId: criterion.rowId,
        bidder,
        documentName: docName,
        pageNumber: 1,
        fileType: ext,
        imageDataUrl: `data:${mime};base64,${base64}`,
        pageText: text,
      });
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const zipFile = formData.get("zip") as File | null;
    const bidderName = formData.get("bidder") as string | null;

    if (!zipFile) {
      return NextResponse.json({ error: "No ZIP file provided" }, { status: 400 });
    }
    if (!bidderName) {
      return NextResponse.json({ error: "No bidder name provided" }, { status: 400 });
    }

    const zipBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    const allPaths = Object.keys(zip.files);
    const bidderPrefix = allPaths.find((p) => {
      const parts = p.split("/").filter(Boolean);
      return parts.length >= 2 && parts[1] === bidderName;
    });

    if (!bidderPrefix) {
      return NextResponse.json(
        { error: `Bidder folder "${bidderName}" not found in ZIP` },
        { status: 404 }
      );
    }

    const rootFolder = bidderPrefix.split("/").filter(Boolean)[0];
    const prefix = `${rootFolder}/${bidderName}/`;

    const bidderFiles: { name: string; path: string }[] = [];
    zip.forEach((relativePath, file) => {
      if (
        relativePath.startsWith(prefix) &&
        !file.dir &&
        relativePath.length > prefix.length
      ) {
        const fileName = relativePath.substring(prefix.length).split("/").pop() ?? "";
        if (fileName) {
          bidderFiles.push({ name: fileName, path: relativePath });
        }
      }
    });

    const allResults: MatchResult[] = [];
    const pdfExtensions = ["pdf"];
    const docxExtensions = ["docx"];
    const imageExtensions = ["jpg", "jpeg", "png", "tiff", "tif", "bmp"];

    for (const file of bidderFiles) {
      const ext = getFileExtension(file.name);
      const fileData = await zip.file(file.path)!.async("uint8array");

      try {
        if (pdfExtensions.includes(ext)) {
          const matches = await processPdf(fileData, bidderName, file.name);
          allResults.push(...matches);
        } else if (docxExtensions.includes(ext)) {
          const matches = await processDocx(
            Buffer.from(fileData),
            bidderName,
            file.name
          );
          allResults.push(...matches);
        } else if (imageExtensions.includes(ext)) {
          const matches = await processImage(fileData, bidderName, file.name, ext);
          allResults.push(...matches);
        }
      } catch (err) {
        console.error(`Error processing ${file.path}:`, err);
      }
    }

    return NextResponse.json({ results: allResults });
  } catch (err) {
    console.error("process-bidder-docs error:", err);
    return NextResponse.json(
      { error: "Failed to process documents" },
      { status: 500 }
    );
  }
}
