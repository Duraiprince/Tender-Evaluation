"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const EVALUATION_TYPES = [
  {
    key: "pq-experience",
    title: "PQC Experience Criteria",
    description: "Pre-qualification criteria based on prior project experience",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    key: "pq-financial",
    title: "PQ Financial Criteria",
    description: "Pre-qualification criteria based on financial standing",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    key: "technical-evaluation",
    title: "Technical Evaluation",
    description: "Technical compliance, specifications, and document review",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  {
    key: "commercial-evaluation",
    title: "Commercial Evaluation",
    description: "Pricing, commercial terms, and bid conditions review",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
];

export default function BidderEvalMenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenderId = params.id as string;
  const bidderName = decodeURIComponent(params.bidderName as string);

  const name = searchParams.get("name") ?? "";
  const number = searchParams.get("number") ?? "";
  const bidders = searchParams.get("bidders") ?? "";

  const qs = `name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&bidders=${encodeURIComponent(bidders)}`;
  const biddersHref = `/materials/${tenderId}?${qs}`;

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/materials" className="hover:text-gray-700 transition-colors">
            Materials
          </Link>
          <span>/</span>
          <Link href={biddersHref} className="hover:text-gray-700 transition-colors">
            Bidders
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium truncate max-w-xs">{bidderName}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-1 rounded-full bg-gray-900" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{bidderName}</h1>
          </div>
          <p className="text-sm text-gray-500 ml-[1.1rem] pl-3">
            Select an evaluation category to review
          </p>
        </div>

        {/* Evaluation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVALUATION_TYPES.map((ev) => (
            <Link
              key={ev.key}
              href={`/materials/${tenderId}/bidders/${encodeURIComponent(bidderName)}/${ev.key}?${qs}`}
            >
              <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group active:scale-[0.98] h-full">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${ev.bg} ${ev.color} mb-4 border ${ev.border}`}>
                  {ev.icon}
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-gray-900 mb-1 text-sm">
                  {ev.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">{ev.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link
            href={biddersHref}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Bidder List
          </Link>
        </div>

      </div>
    </AppLayout>
  );
}
