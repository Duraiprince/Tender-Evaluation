"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function PQFinancialPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenderId = params.id as string;
  const bidderName = decodeURIComponent(params.bidderName as string);

  const name = searchParams.get("name") ?? "";
  const number = searchParams.get("number") ?? "";
  const biddersParam = searchParams.get("bidders") ?? "";

  const qs = `name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&bidders=${encodeURIComponent(biddersParam)}`;
  const backHref = `/materials/${tenderId}/bidders/${encodeURIComponent(bidderName)}?${qs}`;
  const biddersHref = `/materials/${tenderId}?${qs}`;

  const criteria = [
    {
      sl: 1,
      description: "Annual Turnover",
      requirement: "Minimum annual turnover of INR — (as specified in NIT) during last 3 financial years",
      remarks: "",
    },
    {
      sl: 2,
      description: "Net Worth",
      requirement: "Positive net worth as per latest audited balance sheet",
      remarks: "",
    },
    {
      sl: 3,
      description: "Solvency Certificate",
      requirement: "Valid solvency certificate from a scheduled bank",
      remarks: "",
    },
    {
      sl: 4,
      description: "Audited Financial Statements",
      requirement: "Last 3 years audited balance sheet and P&L to be submitted",
      remarks: "",
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
          <Link href="/materials" className="hover:text-gray-600 transition-colors">Materials</Link>
          <span>/</span>
          <Link href={biddersHref} className="hover:text-gray-600 transition-colors">Bidders</Link>
          <span>/</span>
          <Link href={backHref} className="hover:text-gray-600 transition-colors truncate max-w-[160px]">{bidderName}</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">PQ Financial Criteria</span>
        </nav>

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-1 rounded-full bg-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PQ Financial Criteria</h1>
          </div>
          <p className="text-sm text-gray-500 ml-[1.1rem] pl-3">
            Evaluating: <span className="font-semibold text-gray-700">{bidderName}</span>
          </p>
        </div>

        {/* Evaluation Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Financial Criteria Checklist
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-4 py-3.5 text-left font-semibold w-16 text-xs uppercase tracking-wider">Sl. No.</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider">Criteria Description</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-64">Tender Requirement</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-40">Bidder Value</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {criteria.map((row, idx) => (
                  <tr key={row.sl} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-blue-50/30 transition-colors`}>
                    <td className="px-4 py-4 text-center font-semibold text-gray-400 align-top">{row.sl}</td>
                    <td className="px-4 py-4 font-medium text-gray-800 align-top">{row.description}</td>
                    <td className="px-4 py-4 text-gray-600 align-top text-xs leading-relaxed">{row.requirement}</td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="text"
                        placeholder="Enter value"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white"
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                        <option value="">— Select —</option>
                        <option value="complied">Meets Criteria</option>
                        <option value="not-complied">Does Not Meet</option>
                        <option value="query">Requires Clarification</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Financial Evaluation Summary — {bidderName}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-start gap-4">
              <label className="text-sm font-medium text-gray-600 pt-2">Remarks</label>
              <textarea
                placeholder="Add remarks on financial criteria compliance..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-gray-50/50 resize-none"
              />
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-4">
              <label className="text-sm font-medium text-gray-600">PQ Financial Status</label>
              <select className="w-64 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                <option value="">— Pending —</option>
                <option value="qualified">Qualified</option>
                <option value="not-qualified">Not Qualified</option>
                <option value="query">Query to be Raised</option>
              </select>
            </div>
          </div>
        </div>

        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to {bidderName}
        </Link>

      </div>
    </AppLayout>
  );
}
