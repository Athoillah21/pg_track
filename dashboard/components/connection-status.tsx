"use client";

import { useEffect, useState, useTransition } from "react";
import { clearActiveConnection } from "@/actions/connection";
import { useRouter, usePathname } from "next/navigation";
import { Database, LogOut, Unplug } from "lucide-react";

type ActiveConnectionInfo = {
    id: string;
    name: string;
    host: string;
    database: string;
} | null;

export function ConnectionStatus() {
    const [info, setInfo] = useState<ActiveConnectionInfo>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        async function loadInfo() {
            setIsLoading(true);
            try {
                const res = await fetch('/api/connection-info');
                if (res.ok) {
                    const data = await res.json();
                    setInfo(data);
                } else {
                    setInfo(null);
                }
            } catch (error) {
                console.error("Failed to load connection info", error);
                setInfo(null);
            } finally {
                setIsLoading(false);
            }
        }
        loadInfo();
    }, [pathname]); // Re-fetch when pathname changes

    async function handleLogout() {
        startTransition(async () => {
            await clearActiveConnection();
            setInfo(null);
            router.push('/connect?disconnected=true');
        });
    }

    if (isLoading) {
        return (
            <div className="h-8 w-24 bg-muted/50 rounded-md animate-pulse" />
        );
    }

    if (!info) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 rounded-md border border-dashed border-border">
                <Unplug className="w-3.5 h-3.5" />
                Not Connected
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground bg-primary/10 rounded-md border border-primary/20">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span className="max-w-[150px] truncate">{info.name}</span>
                <span className="text-muted-foreground font-mono text-[10px]">({info.database})</span>
            </div>
            <button
                onClick={handleLogout}
                disabled={isPending}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title="Disconnect"
            >
                <LogOut className="w-4 h-4" />
            </button>
        </div>
    );
}
