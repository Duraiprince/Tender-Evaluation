/**
 * In-memory store for the uploaded Tender / NIT document ZIP.
 * Mirrors the pattern used by bidder-store.ts.
 */

let nitZipFile: File | null = null;

export function setNitZip(file: File | null): void {
  nitZipFile = file;
}

export function getNitZip(): File | null {
  return nitZipFile;
}

export function hasNitZip(): boolean {
  return nitZipFile !== null;
}
