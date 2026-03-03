"use client";

import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function MaterialsTenderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const name = searchParams.get("name") ?? "";
  const number = searchParams.get("number") ?? "";
  const bidders = searchParams.get("bidders") ?? "";

  const tenderTitle = number
    ? `TENDER_${number}_${name}`
    : `TENDER_${name}`;

  const qs = `name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&bidders=${encodeURIComponent(bidders)}`;

  const actions = [
    { href: `/materials/${id}/pq-experience?${qs}`, title: "PQ Experience Criteria" },
    { href: `/materials/${id}/pq-financial?${qs}`, title: "PQ Financial Criteria" },
    { href: `/materials/${id}/technical-evaluation?${qs}`, title: "Technical Evaluation" },
    { href: `/materials/${id}/commercial-evaluation?${qs}`, title: "Commercial Evaluation" },
  ];

  return (
    <AppLayout>
      <div className="p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/materials" className="hover:text-gray-700">Materials</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">{tenderTitle}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{tenderTitle}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group active:scale-95">
                <h3 className="font-semibold text-gray-800 group-hover:text-gray-900">{action.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
