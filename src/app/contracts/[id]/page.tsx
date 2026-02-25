import AppLayout from "@/components/AppLayout";
import Link from "next/link";

const tenderNames: Record<string, string> = {
  "1": "TENDER-1 (NAME)",
  "2": "TENDER-2 (NAME)",
};

export default async function ContractsTenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenderName = tenderNames[id] ?? `TENDER-${id} (NAME)`;

  const actions = [
    { href: `/contracts/${id}/pq-technical`, title: "PQ Exp @ Technical Evaluation" },
    { href: `/contracts/${id}/pq-financial`, title: "PQ Fin & Commercial Evaluation" },
  ];

  return (
    <AppLayout>
      <div className="p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/contracts" className="hover:text-gray-700">Contracts</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">{tenderName}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{tenderName}</h1>
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
