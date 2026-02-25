import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Quick Evaluate</h1>
        </div>

        {/* Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <CategoryCard href="/contracts" title="Contracts" />
            <CategoryCard href="/materials" title="Materials" />
          </div>
      </div>
    </AppLayout>
  );
}

function CategoryCard({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href}>
      <div className="rounded-xl border border-gray-200 bg-white p-6 cursor-pointer transition-all duration-150 group hover:shadow-md hover:border-gray-300 active:scale-95 active:shadow-inner active:bg-gray-50">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-gray-700">{title}</h3>
      </div>
    </Link>
  );
}
