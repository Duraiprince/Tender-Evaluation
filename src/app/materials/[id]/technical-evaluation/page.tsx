"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import { getBidderZip } from "@/lib/bidder-store";
import { getNitZip, hasNitZip } from "@/lib/nit-store";

interface EvaluationRow {
  id: number;
  description: string;
  requirement: string;
  bidderValue: string;
}

const createInitialRows = (): EvaluationRow[] => [
  { id: 1, description: "Technical Specification", requirement: "Sign & Seal", bidderValue: "" },
  { id: 2, description: "NIL Deviation Statement", requirement: "Sign & Seal", bidderValue: "" },
  { id: 3, description: "Additional User Department Requirement", requirement: "Indenter to fill", bidderValue: "" },
  { id: 4, description: "Deviations", requirement: "If any", bidderValue: "" },
];

type EvaluationStatus = "" | "Qualified" | "Not Qualified" | "Query to be Raised";

interface DocMatch {
  rowId: number;
  documentName: string;
  pageNumber: number;
  fileType: string;
  imageDataUrl: string;
  pageText: string;
}

interface BidderEvaluation {
  rows: EvaluationRow[];
  query: string;
  evaluationStatus: EvaluationStatus;
  rejectionReason: string;
}

type ProcessingState = "idle" | "loading" | "done" | "error";

// ── Tender page match types ───────────────────────────────────────────────────

interface TenderMatchCandidate {
  documentName: string;
  pageNumber: number;
  confidence: number;
  pageData: { pageNumber: number; text: string; imageDataUrl: string };
}

interface TenderPageRef {
  pageNumber: number;
  documentName: string;
  imageDataUrl: string;
  text: string;
}

interface TenderMatchResult {
  status:
    | "match_signed_digital"
    | "match_signed_physical"
    | "match_signed_both"
    | "match_unsigned"
    | "no_match";
  match: TenderMatchCandidate | null;
  topCandidates: TenderMatchCandidate[];
  signatureInfo: {
    digital: { detected: boolean; signerName?: string; signingTime?: string; validityStatus?: string };
    physical: { detected: boolean; indicators: string[] };
  } | null;
  tenderPage: TenderPageRef | null;
  nextPage: TenderPageRef | null;
}

// Human-readable section labels per row id
const ROW_SECTION_LABEL: Record<number, string> = {
  1: "SECTION – 3 (Technical Specification)",
  2: "8.3 – Compliance to Bid Requirements Deviation Sheet",
};

export default function TechnicalEvaluationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const name = searchParams.get("name") ?? "";
  const number = searchParams.get("number") ?? "";
  const biddersParam = searchParams.get("bidders") ?? "";

  const tenderNo = number;
  const nameOfWork = name;

  const bidders = useMemo(
    () => biddersParam.split(",").filter(Boolean),
    [biddersParam]
  );

  const [activeTab, setActiveTab] = useState(0);

  const [evaluations, setEvaluations] = useState<Record<string, BidderEvaluation>>(() => {
    const init: Record<string, BidderEvaluation> = {};
    bidders.forEach((b) => {
      init[b] = {
        rows: createInitialRows(),
        query: "",
        evaluationStatus: "",
        rejectionReason: "",
      };
    });
    return init;
  });

  // Per-bidder document processing state
  const [docMatches, setDocMatches] = useState<Record<string, DocMatch[]>>({});
  const [processingState, setProcessingState] = useState<Record<string, ProcessingState>>({});
  const [processingError, setProcessingError] = useState<Record<string, string>>({});
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Tender page match state: key = `${bidder}:${rowId}`
  const [matchResults, setMatchResults] = useState<Record<string, TenderMatchResult>>({});
  const [matchLoading, setMatchLoading] = useState<Record<string, boolean>>({});
  const [matchError, setMatchError] = useState<Record<string, string>>({});

  // Whether the NIT zip is available (set on the upload page)
  const nitAvailable = hasNitZip();

  const activeBidder = bidders[activeTab] ?? "";
  const activeEval = evaluations[activeBidder];
  const allActiveMatches = docMatches[activeBidder] ?? [];
  const activeProcessing = processingState[activeBidder] ?? "idle";
  const activeError = processingError[activeBidder] ?? "";

  const getMatchesForRow = (rowId: number) =>
    allActiveMatches.filter((m) => m.rowId === rowId);

  const processBidderDocs = useCallback(async (bidder: string) => {
    const zipFile = getBidderZip();
    if (!zipFile) {
      setProcessingState((p) => ({ ...p, [bidder]: "error" }));
      setProcessingError((p) => ({
        ...p,
        [bidder]: "ZIP file not available. Please go back and re-upload.",
      }));
      return;
    }

    setProcessingState((p) => ({ ...p, [bidder]: "loading" }));
    setProcessingError((p) => ({ ...p, [bidder]: "" }));

    try {
      const formData = new FormData();
      formData.append("zip", zipFile);
      formData.append("bidder", bidder);

      const response = await fetch("/api/process-bidder-docs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setDocMatches((prev) => ({ ...prev, [bidder]: data.results ?? [] }));
      setProcessingState((p) => ({ ...p, [bidder]: "done" }));
    } catch (err) {
      setProcessingState((p) => ({ ...p, [bidder]: "error" }));
      setProcessingError((p) => ({
        ...p,
        [bidder]: err instanceof Error ? err.message : "Processing failed",
      }));
    }
  }, []);

  // Auto-process when a bidder tab is selected for the first time
  useEffect(() => {
    if (activeBidder && !processingState[activeBidder]) {
      processBidderDocs(activeBidder);
    }
  }, [activeBidder, processingState, processBidderDocs]);

  // Run the tender page match for a specific row using stored NIT zip + bidder offer zip
  const runTenderPageMatch = useCallback(
    async (bidder: string, rowId: number) => {
      const offerZip = getBidderZip();
      if (!offerZip) return;

      const key = `${bidder}:${rowId}`;
      setMatchLoading((p) => ({ ...p, [key]: true }));
      setMatchError((p) => ({ ...p, [key]: "" }));

      try {
        const formData = new FormData();
        formData.append("offerZip", offerZip);
        formData.append("bidder", bidder);
        formData.append("rowId", String(rowId));

        const nitZip = getNitZip();
        if (nitZip) formData.append("nitZip", nitZip);

        const res = await fetch("/api/match-tender-page", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error: ${res.status}`);
        }

        const result: TenderMatchResult = await res.json();
        setMatchResults((p) => ({ ...p, [key]: result }));
      } catch (err) {
        setMatchError((p) => ({
          ...p,
          [key]: err instanceof Error ? err.message : "Match failed",
        }));
      } finally {
        setMatchLoading((p) => ({ ...p, [key]: false }));
      }
    },
    []
  );

  // Auto-run tender page matching for rows 1 & 2 once doc processing completes
  useEffect(() => {
    if (!activeBidder || activeProcessing !== "done") return;
    [1, 2].forEach((rowId) => {
      const key = `${activeBidder}:${rowId}`;
      if (!matchResults[key] && !matchLoading[key]) {
        runTenderPageMatch(activeBidder, rowId);
      }
    });
  }, [activeBidder, activeProcessing, matchResults, matchLoading, runTenderPageMatch]);

  // Auto-determine evaluation status based on whether tender page match was found
  useEffect(() => {
    if (!activeBidder || activeProcessing !== "done") return;

    const key1 = `${activeBidder}:1`;
    const key2 = `${activeBidder}:2`;
    const result1 = matchResults[key1];
    const result2 = matchResults[key2];

    // Wait until both tender match results are available before setting status
    if (!result1 || !result2) return;

    const currentQuery = evaluations[activeBidder]?.query ?? "";

    // A row passes when any match is found (regardless of signature status)
    const rowMatchFound = (r: TenderMatchResult) => r.status !== "no_match";

    const row1Ok = rowMatchFound(result1);
    const row2Ok = rowMatchFound(result2);
    const allSubmitted = row1Ok && row2Ok;

    let newStatus: EvaluationStatus;
    if (!allSubmitted) {
      newStatus = "Not Qualified";
    } else if (currentQuery.trim()) {
      newStatus = "Query to be Raised";
    } else {
      newStatus = "Qualified";
    }

    setEvaluations((prev) => {
      if (prev[activeBidder]?.evaluationStatus === newStatus) return prev;
      return {
        ...prev,
        [activeBidder]: { ...prev[activeBidder], evaluationStatus: newStatus },
      };
    });
  }, [activeBidder, activeProcessing, matchResults, evaluations]);

  const updateField = <K extends keyof BidderEvaluation>(
    field: K,
    value: BidderEvaluation[K]
  ) => {
    setEvaluations((prev) => ({
      ...prev,
      [activeBidder]: { ...prev[activeBidder], [field]: value },
    }));
  };

  const updateBidderValue = (rowId: number, value: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [activeBidder]: {
        ...prev[activeBidder],
        rows: prev[activeBidder].rows.map((r) =>
          r.id === rowId ? { ...r, bidderValue: value } : r
        ),
      },
    }));
  };

  const statusColors: Record<EvaluationStatus, string> = {
    "": "",
    Qualified: "bg-emerald-50 border-emerald-200 text-emerald-700",
    "Not Qualified": "bg-red-50 border-red-200 text-red-700",
    "Query to be Raised": "bg-amber-50 border-amber-200 text-amber-700",
  };

  const statusDot: Record<EvaluationStatus, string> = {
    "": "bg-gray-300",
    Qualified: "bg-emerald-500",
    "Not Qualified": "bg-red-500",
    "Query to be Raised": "bg-amber-500",
  };

  const backHref = `/materials/${id}?name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&bidders=${encodeURIComponent(biddersParam)}`;

  const renderOcrCell = (rowId: number) => {
    const matches = getMatchesForRow(rowId);
    const matchKey = `${activeBidder}:${rowId}`;
    const tenderMatchResult = matchResults[matchKey];
    const isTenderMatchLoading = matchLoading[matchKey] ?? false;

    if (activeProcessing === "loading") {
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-600">Scanning documents...</span>
        </div>
      );
    }

    if (activeProcessing === "error") {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {activeError}
          </div>
          <button
            onClick={() => processBidderDocs(activeBidder)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      );
    }

    if (activeProcessing !== "done") return null;

    // Primary: use tender match result; fallback: keyword-based doc matches
    const hasTenderMatch = tenderMatchResult && tenderMatchResult.status !== "no_match";
    const hasDocMatch = matches.length > 0;

    // While tender matching is in progress and no doc match yet, show a verifying indicator
    if (isTenderMatchLoading && !hasDocMatch) {
      return (
        <div className="flex items-center gap-2 py-2 text-xs text-indigo-600">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Verifying against tender document...
        </div>
      );
    }

    // Not submitted — shown when both matching sources confirm no match
    if (!hasTenderMatch && !hasDocMatch) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-500 font-medium py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Not Submitted
        </div>
      );
    }

    // Display reference label (prefer tender match data, fall back to doc matches)
    const displayRef = hasTenderMatch && tenderMatchResult!.match
      ? { documentName: tenderMatchResult!.match.documentName, pageNumber: tenderMatchResult!.match.pageNumber }
      : hasDocMatch
      ? { documentName: matches[0].documentName, pageNumber: matches[0].pageNumber }
      : null;

    return (
      <div className="space-y-2">
        {/* Submitted status */}
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
          </svg>
          Submitted{displayRef ? ` — ${displayRef.documentName}, Page ${displayRef.pageNumber}` : ""}
        </div>

        {/* Show doc match thumbnails only when no tender match panel will be rendered */}
        {!hasTenderMatch && hasDocMatch && (
          <div className="space-y-3 mt-1">
            {matches.map((match, i) =>
              match.imageDataUrl ? (
                <div
                  key={i}
                  className="relative border border-gray-200 rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => setExpandedImage(match.imageDataUrl)}
                >
                  <img
                    src={match.imageDataUrl}
                    alt={`${match.documentName} page ${match.pageNumber}`}
                    className="w-full h-auto max-h-48 object-contain bg-gray-50"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-black/60 text-white px-2 py-1 rounded">
                      Click to expand
                    </span>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Tender page match panel ─────────────────────────────────────────────────
  const renderMatchPanel = (rowId: number) => {
    const key = `${activeBidder}:${rowId}`;
    const isLoading = matchLoading[key];
    const error = matchError[key];
    const result = matchResults[key];
    const sectionLabel = ROW_SECTION_LABEL[rowId] ?? "Tender Section";

    // Initial state: show a trigger button
    if (!result && !isLoading && !error) {
      return (
        <button
          onClick={() => runTenderPageMatch(activeBidder, rowId)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {nitAvailable ? "Match against Tender Document" : "Find section match (no NIT uploaded)"}
        </button>
      );
    }

    if (isLoading) {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Scanning documents for <span className="font-semibold ml-1">{sectionLabel}</span>…
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
          <button onClick={() => runTenderPageMatch(activeBidder, rowId)} className="text-xs text-indigo-600 hover:underline">
            Retry
          </button>
        </div>
      );
    }

    if (!result) return null;

    const { status, match, signatureInfo, tenderPage, nextPage } = result;

    // No match found
    if (status === "no_match" || !match) {
      return (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{activeBidder} has not submitted a signed copy of the tender page for <em>{sectionLabel}</em></span>
          </div>
          {/* Show the tender reference page so evaluator can compare */}
          {tenderPage?.imageDataUrl && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-2 py-1 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                Tender reference — {tenderPage.documentName}, Page {tenderPage.pageNumber}
              </div>
              <div className="cursor-pointer group" onClick={() => setExpandedImage(tenderPage.imageDataUrl)}>
                <img src={tenderPage.imageDataUrl} alt="Tender reference page" className="w-full h-auto max-h-48 object-contain bg-white" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
            </div>
          )}
          <button onClick={() => runTenderPageMatch(activeBidder, rowId)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Re-scan
          </button>
        </div>
      );
    }

    const confidencePct = Math.round(match.confidence * 100);

    return (
      <div className="mt-2 border border-indigo-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-200">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-800 truncate">
              {match.documentName} — Page {match.pageNumber}
            </p>
            <p className="text-xs text-indigo-500">{confidencePct}% match · {sectionLabel}</p>
          </div>
          <button
            onClick={() => runTenderPageMatch(activeBidder, rowId)}
            title="Re-run match"
            className="ml-2 flex-shrink-0 text-indigo-400 hover:text-indigo-700 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        {/* Side-by-side: tender reference page vs bidder submitted page */}
        <div className={`grid gap-px bg-gray-200 ${tenderPage?.imageDataUrl ? "grid-cols-2" : "grid-cols-1"}`}>
          {tenderPage?.imageDataUrl && (
            <div className="bg-white">
              <div className="px-2 py-1 text-xs text-gray-500 font-medium bg-gray-50 border-b border-gray-200">
                Tender — {tenderPage.documentName}, pg.{tenderPage.pageNumber}
              </div>
              <div className="cursor-pointer group relative" onClick={() => setExpandedImage(tenderPage.imageDataUrl)}>
                <img src={tenderPage.imageDataUrl} alt="Tender reference" className="w-full h-auto max-h-64 object-contain bg-white" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-black/60 text-white px-2 py-1 rounded">Expand</span>
                </div>
              </div>
            </div>
          )}
          {match.pageData.imageDataUrl && (
            <div className="bg-white">
              <div className="px-2 py-1 text-xs text-gray-500 font-medium bg-gray-50 border-b border-gray-200">
                {activeBidder} — {match.documentName}, pg.{match.pageNumber}
              </div>
              <div className="cursor-pointer group relative" onClick={() => setExpandedImage(match.pageData.imageDataUrl)}>
                <img src={match.pageData.imageDataUrl} alt={`${activeBidder} submitted page`} className="w-full h-auto max-h-64 object-contain bg-white" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-black/60 text-white px-2 py-1 rounded">Expand</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDeviationsCell = () => {
    if (activeProcessing === "loading") {
      return (
        <div className="flex items-center gap-3 py-2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-600">Checking for deviations...</span>
        </div>
      );
    }

    if (activeProcessing !== "done") return <span className="text-sm text-gray-400">—</span>;

    const row1Matches = getMatchesForRow(1);
    const row2Matches = getMatchesForRow(2);
    const allMatches = [...row1Matches, ...row2Matches].filter(
      (m) => m.pageText && m.imageDataUrl
    );

    if (allMatches.length === 0) {
      return <span className="text-sm text-gray-400">No Deviations Found</span>;
    }

    return (
      <div className="space-y-3">
        {allMatches.map((match, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {match.documentName} — Page {match.pageNumber}
            </div>
            <div
              className="relative border border-gray-200 rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => setExpandedImage(match.imageDataUrl)}
            >
              <img
                src={match.imageDataUrl}
                alt={`${match.documentName} page ${match.pageNumber}`}
                className="w-full h-auto max-h-48 object-contain bg-gray-50"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-black/60 text-white px-2 py-1 rounded">
                  Click to expand
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/materials" className="hover:text-gray-600 transition-colors">
            Materials
          </Link>
          <span>/</span>
          <Link href={backHref} className="hover:text-gray-600 transition-colors">
            {number ? `TENDER_${number}_${name}` : `TENDER_${name}`}
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Technical Evaluation</span>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-1 rounded-full bg-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Technical Evaluation
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-[1.1rem] pl-3">
            Evaluate bidder submissions against tender technical requirements
          </p>
        </div>

        {/* Tender Info Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Tender Information
            </h2>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Tender No.
              </label>
              <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-gray-50 min-h-[42px]">
                {tenderNo || <span className="text-gray-400">—</span>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Name of Work
              </label>
              <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-gray-50 min-h-[42px]">
                {nameOfWork || <span className="text-gray-400">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Bidder Tabs */}
        {bidders.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-center">
            <p className="text-sm text-amber-700 font-medium">No bidders found.</p>
            <p className="text-xs text-amber-600 mt-1">
              Please go back and upload a Bidder Offers ZIP file with folders for each bidder.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Bidders ({bidders.length})
                </h2>
              </div>
              <div className="px-4 pt-3 pb-0 flex gap-1 overflow-x-auto">
                {bidders.map((bidder, idx) => {
                  const isActive = idx === activeTab;
                  const bidderStatus = evaluations[bidder]?.evaluationStatus ?? "";
                  return (
                    <button
                      key={bidder}
                      onClick={() => setActiveTab(idx)}
                      className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-gray-900 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive && !bidderStatus
                            ? "bg-white/40"
                            : statusDot[bidderStatus]
                        }`}
                      />
                      {bidder}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Evaluation Table for active bidder */}
            {activeEval && (
              <>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Evaluation Criteria
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        Evaluating: <span className="font-semibold text-gray-700">{activeBidder}</span>
                      </span>
                      {activeProcessing === "done" && (
                        <button
                          onClick={() => {
                            setProcessingState((p) => ({ ...p, [activeBidder]: "idle" as ProcessingState }));
                            setTimeout(() => processBidderDocs(activeBidder), 50);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                          </svg>
                          Re-scan
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900 text-white">
                          <th className="px-4 py-3.5 text-left font-semibold w-16 text-xs uppercase tracking-wider">
                            Sl. No.
                          </th>
                          <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider">
                            Item Description
                          </th>
                          <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-48">
                            Tender Requirement
                          </th>
                          <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-72">
                            {activeBidder}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeEval.rows.map((row, idx) => (
                          <tr
                            key={row.id}
                            className={`group transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                            } hover:bg-blue-50/40`}
                          >
                            <td className="px-4 py-4 text-center font-semibold text-gray-400 align-top">
                              {row.id}
                            </td>
                            <td className="px-4 py-4 font-medium text-gray-800 align-top">
                              {row.description}
                            </td>
                            <td className="px-4 py-4 align-top">
                              {row.requirement}
                            </td>
                            <td className="px-4 py-4 align-top">
                              {row.id === 1 || row.id === 2 ? (
                                <div>
                                  {renderOcrCell(row.id)}
                                  {renderMatchPanel(row.id)}
                                </div>
                              ) : row.id === 3 ? (
                                <span className="text-sm text-gray-700">Complied / Not complied</span>
                              ) : row.id === 4 ? (
                                renderDeviationsCell()
                              ) : (
                                <input
                                  type="text"
                                  value={row.bidderValue}
                                  onChange={(e) => updateBidderValue(row.id, e.target.value)}
                                  placeholder="Enter response"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white"
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Evaluation Summary */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Evaluation Summary — {activeBidder}
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {/* Query */}
                    <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-start gap-4">
                      <label className="text-sm font-medium text-gray-600 pt-2">
                        Query to be Raised
                      </label>
                      <div className="space-y-3">
                        {(() => {
                          const row1Matches = getMatchesForRow(1);
                          const row2Matches = getMatchesForRow(2);
                          const deviations = [...row1Matches, ...row2Matches].filter(
                            (m) => m.pageText
                          );
                          if (activeProcessing === "done" && deviations.length > 0) {
                            const draftLines = deviations.map((d) => {
                              const snippet =
                                d.pageText.length > 200
                                  ? d.pageText.slice(0, 200).trim() + "..."
                                  : d.pageText.trim();
                              return `Deviation noted in "${d.documentName}" (Page ${d.pageNumber}):\n"${snippet}"`;
                            });
                            const draft =
                              `The following deviation(s) were identified in the bidder's submission and require clarification:\n\n` +
                              draftLines.join("\n\n") +
                              `\n\nPlease provide justification or revised compliance for the above deviation(s).`;

                            return (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                  Auto-drafted from Sl.No 4 Deviations
                                </div>
                                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                                  {draft}
                                </p>
                                <button
                                  onClick={() => updateField("query", draft)}
                                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                                >
                                  Use this as query
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <textarea
                          value={activeEval.query}
                          onChange={(e) => updateField("query", e.target.value)}
                          placeholder="Enter query details, if any"
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-gray-50/50 resize-none"
                        />
                      </div>
                    </div>

                    {/* Evaluation Status — auto-determined */}
                    <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-4">
                      <label className="text-sm font-medium text-gray-600">
                        Technical Evaluation Status
                      </label>
                      <div>
                        {activeProcessing === "done" && activeEval.evaluationStatus ? (
                          <span
                            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border ${statusColors[activeEval.evaluationStatus]}`}
                          >
                            {activeEval.evaluationStatus === "Qualified" && (
                              <span className="inline-block mr-1.5">&#10003;</span>
                            )}
                            {activeEval.evaluationStatus === "Not Qualified" && (
                              <span className="inline-block mr-1.5">&#10005;</span>
                            )}
                            {activeEval.evaluationStatus === "Query to be Raised" && (
                              <span className="inline-block mr-1.5">?</span>
                            )}
                            {activeEval.evaluationStatus}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Pending evaluation...</span>
                        )}
                      </div>
                    </div>

                    {/* Reason for Rejection (Not Qualified) — always visible */}
                    <div className={`px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-start gap-4 ${activeEval.evaluationStatus === "Not Qualified" ? "bg-red-50/30" : ""}`}>
                      <label className={`text-sm font-medium pt-2 ${activeEval.evaluationStatus === "Not Qualified" ? "text-red-700" : "text-gray-600"}`}>
                        Reason for Rejection (Not Qualified)
                      </label>
                      {activeEval.evaluationStatus === "Not Qualified" ? (
                        <textarea
                          value={activeEval.rejectionReason}
                          onChange={(e) => updateField("rejectionReason", e.target.value)}
                          placeholder="Provide the reason for rejection"
                          rows={2}
                          className="w-full border border-red-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all bg-white resize-none"
                        />
                      ) : (
                        <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-400 bg-gray-50 min-h-[42px]">
                          if any
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>

      {/* Fullscreen Image Overlay */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm flex items-center gap-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Close
            </button>
            <img
              src={expandedImage}
              alt="Expanded document page"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
