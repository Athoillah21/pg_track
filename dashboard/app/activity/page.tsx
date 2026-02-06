
import { getRecentHistory, ChangeHistory } from "@/actions/history";
import { isConnected as checkConnection } from "@/actions/session";
import { HistoryList } from "@/components/history-list";
import { Activity, Unplug } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const connected = await checkConnection();

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Global Activity
          </h2>
          <p className="text-muted-foreground">
            Stream of all changes across the entire database.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-border rounded-lg bg-muted/20 text-center">
          <Unplug className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Not Connected</h3>
          <p className="text-muted-foreground mt-1">Please connect to a database to view activity.</p>
          <Link href="/connect" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            Go to Connections
          </Link>
        </div>
      </div>
    );
  }

  const history = await getRecentHistory(100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Global Activity
        </h2>
        <p className="text-muted-foreground">
          Stream of all changes across the entire database.
        </p>
      </div>

      <HistoryList initialHistory={history} />
    </div>
  );
}
