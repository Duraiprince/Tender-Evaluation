"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function CommercialEvaluationPage() {
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
      description: "Quoted Price / BOQ",
      requirement: "As per tender BOQ format",
      remarks: "",
    },
    {
      sl: 2,
      description: "Payment Terms",
      requirement: "As per tender payment terms; deviations to be listed",
      remarks: "",
    },
    {
      sl: 3,
      description: "Delivery / Completion Period",
      requirement: "Within specified timeline; penalties for delay as per contract",
      remarks: "",
    },
    {
      sl: 4,
      description: "Performance Bank Guarantee",
      requirement: "10% of order value valid for contract period + 6 months",
      remarks: "",
    },
    {
      sl: 5,
      description: "Warranty / Guarantee Period",
      requirement: "Minimum 12 months from date of commissioning",
      remarks: "",
    },
    {
      sl: 6,
      description: "Validity of Offer",
      requirement: "Minimum 90 days from date of bid opening",
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
          <span className="text-gray-700 font-medium">Commercial Evaluation</span>
        </nav>

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-1 rounded-full bg-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Commercial Evaluation</h1>
          </div>
          <p className="text-sm text-gray-500 ml-[1.1rem] pl-3">
            Evaluating: <span className="font-semibold text-gray-700">{bidderName}</span>
          </p>
        </div>

        {/* Evaluation Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Commercial Criteria Checklist
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-4 py-3.5 text-left font-semibold w-16 text-xs uppercase tracking-wider">Sl. No.</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-64">Tender Requirement</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-48">Bidder's Offer</th>
                  <th className="px-4 py-3.5 text-left font-semibold text-xs uppercase tracking-wider w-40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {criteria.map((row, idx) => (
                  <tr key={row.sl} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-amber-50/30 transition-colors`}>
                    <td className="px-4 py-4 text-center font-semibold text-gray-400 align-top">{row.sl}</td>
                    <td className="px-4 py-4 font-medium text-gray-800 align-top">{row.description}</td>
                    <td className="px-4 py-4 text-gray-600 align-top text-xs leading-relaxed">{row.requirement}</td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="text"
                        placeholder="Enter bidder's offer"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all bg-white"
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all bg-white">
                        <option value="">— Select —</option>
                        <option value="acceptable">Acceptable</option>
                        <option value="deviation">Has Deviation</option>
                        <option value="not-acceptable">Not Acceptable</option>
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
              Commercial Evaluation Summary — {bidderName}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-start gap-4">
              <label className="text-sm font-medium text-gray-600 pt-2">Commercial Remarks</label>
              <textarea
                placeholder="Summarise commercial deviations, clarifications needed, or compliance notes..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all bg-gray-50/50 resize-none"
              />
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-4">
              <label className="text-sm font-medium text-gray-600">Commercial Evaluation Status</label>
              <select className="w-64 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all bg-white">
                <option value="">— Pending —</option>
                <option value="acceptable">Commercially Acceptable</option>
                <option value="deviation">Acceptable with Deviations</option>
                <option value="not-acceptable">Not Acceptable</option>
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
