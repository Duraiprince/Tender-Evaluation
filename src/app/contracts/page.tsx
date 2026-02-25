import AppLayout from "@/components/AppLayout";
import Link from "next/link";

const tenders = [
  { id: "1", name: "TENDER-1 (NAME)", number: "CPCLV25001" },
  { id: "2", name: "TENDER-2 (NAME)", number: "CPCLV25002" },
];

export default function ContractsPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
        </div>

        <div className="flex flex-col gap-3 max-w-2xl">
          {tenders.map((tender) => (
            <Link key={tender.id} href={`/contracts/${tender.id}`}>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-6 py-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group">
                <div>
                  <div className="font-semibold text-gray-800 group-hover:text-gray-900">{tender.name}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
