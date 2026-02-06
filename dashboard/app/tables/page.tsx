
import { getTrackedTables } from "@/actions/history";
import { isConnected as checkConnection } from "@/actions/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ArrowRight, Unplug } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function TablesPage() {
    const connected = await checkConnection();

    if (!connected) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Tracked Tables</h2>
                    <p className="text-muted-foreground">
                        List of all tables currently monitored by pg_track.
                    </p>
                </div>
                <div className="flex flex-col items-center justify-center p-16 border border-dashed border-border rounded-lg bg-muted/20 text-center">
                    <Unplug className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">Not Connected</h3>
                    <p className="text-muted-foreground mt-1">Please connect to a database to view tracked tables.</p>
                    <Link href="/connect" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                        Go to Connections
                    </Link>
                </div>
            </div>
        );
    }

    const tables = await getTrackedTables();

    // Group by schema
    const bySchema: Record<string, typeof tables> = {};
    tables.forEach(t => {
        if (!bySchema[t.schema_name]) bySchema[t.schema_name] = [];
        bySchema[t.schema_name].push(t);
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Tracked Tables</h2>
                <p className="text-muted-foreground">
                    List of all tables currently monitored by pg_track.
                </p>
            </div>

            <div className="grid gap-6">
                {Object.entries(bySchema).map(([schema, tables]) => (
                    <Card key={schema}>
                        <CardHeader className="pb-3 border-b border-border bg-muted/40">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Database className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Schema:</span> <span className="font-mono text-primary font-bold">{schema}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-0 p-0">
                            {tables.map(table => (
                                <div key={table.table_name} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-2 h-2 rounded-full", table.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground")} />
                                        <div>
                                            <div className="font-semibold text-foreground">{table.table_name}</div>
                                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                                PK: [{table.pk_columns.join(', ')}]
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/tables/${schema}/${table.table_name}`}
                                        className="flex items-center gap-1 text-sm text-primary font-medium hover:underline hover:text-primary/80"
                                    >
                                        View History <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
