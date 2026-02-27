/**
 * Per-bidder evaluation data store.
 * All evaluation types are stored independently, keyed by tender ID + bidder name,
 * so switching between bidders always loads isolated, correct data.
 */

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface EvaluationRow {
  id: number;
  description: string;
  requirement: string;
  bidderValue: string;
}

export type EvaluationStatus = "" | "Qualified" | "Not Qualified" | "Query to be Raised";
export type ProcessingState = "idle" | "loading" | "done" | "error";

export interface DocMatch {
  rowId: number;
  documentName: string;
  pageNumber: number;
  fileType: string;
  imageDataUrl: string;
  pageText: string;
}

export interface TenderMatchCandidate {
  documentName: string;
  pageNumber: number;
  confidence: number;
  pageData: { pageNumber: number; text: string; imageDataUrl: string };
}

export interface TenderPageRef {
  pageNumber: number;
  documentName: string;
  imageDataUrl: string;
  text: string;
}

export interface TenderMatchResult {
  status:
    | "match_signed_digital"
    | "match_signed_physical"
    | "match_signed_both"
    | "match_unsigned"
    | "no_match";
  match: TenderMatchCandidate | null;
  topCandidates: TenderMatchCandidate[];
  signatureInfo: {
    digital: {
      detected: boolean;
      signerName?: string;
      signingTime?: string;
      validityStatus?: string;
    };
    physical: { detected: boolean; indicators: string[] };
  } | null;
  tenderPage: TenderPageRef | null;
  nextPage: TenderPageRef | null;
}

// ─── Technical Evaluation State ───────────────────────────────────────────────

export interface BidderTechnicalState {
  rows: EvaluationRow[];
  query: string;
  evaluationStatus: EvaluationStatus;
  rejectionReason: string;
  docMatches: DocMatch[];
  processingState: ProcessingState;
  processingError: string;
  matchResults: Record<number, TenderMatchResult>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

function makeKey(tenderId: string, bidder: string): string {
  return `${tenderId}||${bidder}`;
}

const technicalStore = new Map<string, BidderTechnicalState>();

export function getBidderTechnical(
  tenderId: string,
  bidder: string
): BidderTechnicalState | null {
  return technicalStore.get(makeKey(tenderId, bidder)) ?? null;
}

export function setBidderTechnical(
  tenderId: string,
  bidder: string,
  state: BidderTechnicalState
): void {
  technicalStore.set(makeKey(tenderId, bidder), state);
}

export function hasBidderTechnical(tenderId: string, bidder: string): boolean {
  return technicalStore.has(makeKey(tenderId, bidder));
}

export function clearBidderTechnical(tenderId: string, bidder: string): void {
  technicalStore.delete(makeKey(tenderId, bidder));
}
