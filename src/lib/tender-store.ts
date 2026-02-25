/**
 * In-memory store for the uploaded tender PDF.
 * Mirrors the pattern used by bidder-store.ts.
 */

let tenderFile: File | null = null;

export function setTenderPdf(file: File | null): void {
  tenderFile = file;
}

export function getTenderPdf(): File | null {
  return tenderFile;
}

export function hasTenderPdf(): boolean {
  return tenderFile !== null;
}
