"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function BidderNamesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const bidders = (searchParams.get("bidders") ?? "").split(",").filter(Boolean);
  const name = searchParams.get("name") ?? "";
  const number = searchParams.get("number") ?? "";

  const qs = `name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&bidders=${encodeURIComponent(bidders.join(","))}`;

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link href="/materials" className="hover:text-gray-700 transition-colors">
                Materials
              </Link>
              <span>/</span>
              <span className="text-gray-800 font-medium">Select Bidder</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Bidders</h1>
            <p className="text-sm text-gray-500 mt-1">
              Select a bidder to view their evaluation results
            </p>
          </div>

          {/* Bidder List */}
          {bidders.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <svg
                className="mx-auto mb-3 text-amber-400"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-amber-800 font-semibold mb-1">No bidders found</p>
              <p className="text-xs text-amber-700 mb-4">
                Please go back and upload a valid Bidder Offers ZIP file with one folder per bidder.
              </p>
              <Link
                href="/materials"
                className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
              >
                ← Back to Upload
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bidders.map((bidder, idx) => (
                <Link
                  key={bidder}
                  href={`/materials/${id}/bidders/${encodeURIComponent(bidder)}?${qs}`}
                >
                  <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group active:scale-[0.99] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 group-hover:bg-gray-200 transition-colors flex-shrink-0">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-gray-800 group-hover:text-gray-900">
                        {bidder}
                      </span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <Link
              href="/materials"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Upload new documents
            </Link>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
