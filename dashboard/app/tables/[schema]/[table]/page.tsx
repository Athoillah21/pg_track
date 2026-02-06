
import { getTableHistory } from "@/actions/history";
import { HistoryList } from "@/components/history-list";
import { Database, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    schema: string;
    table: string;
  }>;
}

export default async function TableHistoryPage({ params }: PageProps) {
  const { schema, table } = await params;
  const history = await getTableHistory(schema, table, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tables" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            {schema}.{table}
          </h2>
          <p className="text-slate-500">
            Viewing change history for this table.
          </p>
        </div>
      </div>

      <HistoryList initialHistory={history} />
    </div>
  );
}
