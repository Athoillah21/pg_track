
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Activity, Database, GitBranch, LayoutDashboard, Plug } from "lucide-react";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/theme-toggle";
import { ConnectionStatus } from "@/components/connection-status";
import { ToastProvider } from "@/components/ui/toast";

// ... existing imports ...

export const metadata: Metadata = {
    title: "pg_track Dashboard",
    description: "Version control for your database",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ToastProvider>
                        <div className="flex min-h-screen bg-background transition-colors">
                            {/* Sidebar (Glassmorphism) */}
                            <aside className="w-64 bg-card/80 backdrop-blur-xl border-r border-border hidden md:flex flex-col transition-colors fixed inset-y-0 z-20">
                                <div className="h-16 flex items-center px-6 border-b border-border">
                                    <Link href="/" className="flex items-center gap-2 font-bold text-foreground text-lg hover:opacity-80 transition-opacity">
                                        <GitBranch className="w-5 h-5 text-primary" />
                                        <span>pg_track</span>
                                    </Link>
                                </div>

                                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                                    <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                                        <LayoutDashboard className="w-4 h-4" />
                                        Overview
                                    </Link>
                                    <Link href="/tables" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                                        <Database className="w-4 h-4" />
                                        Tracked Tables
                                    </Link>
                                    <Link href="/activity" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                                        <Activity className="w-4 h-4" />
                                        Global Activity
                                    </Link>
                                    <Link href="/connect" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors">
                                        <Plug className="w-4 h-4" />
                                        Connections
                                    </Link>
                                </nav>

                                <div className="p-4 border-t border-border bg-card/50">
                                    <div className="text-xs text-muted-foreground">
                                        pg_track v1.0
                                    </div>
                                </div>
                            </aside>

                            {/* Main Content */}
                            <main className="flex-1 flex flex-col md:pl-64">
                                <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border px-8 flex items-center justify-between sticky top-0 z-10 transition-colors supports-[backdrop-filter]:bg-background/60">
                                    <h1 className="text-sm font-medium text-muted-foreground">Dashboard</h1>
                                    <div className="flex items-center gap-4">
                                        <ModeToggle />
                                        <ConnectionStatus />
                                    </div>
                                </header>
                                <div className="flex-1 p-8">
                                    {children}
                                </div>
                            </main>
                        </div>
                    </ToastProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
