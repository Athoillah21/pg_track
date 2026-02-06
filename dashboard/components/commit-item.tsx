"use client";

import { ChangeHistory } from "@/actions/history";
import { User, FileJson, Clock, Undo2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { DiffView } from "./diff-view";

interface CommitItemProps {
    change: ChangeHistory;
    onRevert?: (change: ChangeHistory) => void;
    isReverted?: boolean;
}

export function CommitItem({ change, onRevert, isReverted }: CommitItemProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isInsert = change.operation === 'INSERT';
    const isDelete = change.operation === 'DELETE';
    const isUpdate = change.operation === 'UPDATE';

    const colorClass = isInsert ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900' :
        isDelete ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900' :
            'text-blue-600 dark:text-primary bg-blue-50 dark:bg-primary/10 border-blue-200 dark:border-primary/20 shadow-none dark:shadow-[0_0_8px_rgba(59,130,246,0.3)]'; // Blue (Light) / Electric Blue (Dark)

    const icon = isInsert ? '+' : isDelete ? '-' : '~';

    return (
        <div className={`border-b border-border last:border-0 hover:bg-muted/30 -mx-4 transition-colors group ${isReverted ? 'opacity-75' : ''}`}>
            {/* Header Row (Clickable) */}
            <div
                className="flex gap-4 py-4 px-4 cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                {/* Avatar / Icon */}
                <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${colorClass}`}>
                    <span className="font-mono font-bold text-lg">{icon}</span>
                </div>

                <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                                {change.operation} <span className="text-muted-foreground">on</span> {change.schema_name}.{change.table_name}
                            </span>
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border font-mono">
                                v{change.version}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(change.changed_at), { addSuffix: true })}
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground font-mono text-xs truncate max-w-2xl">
                        PK: {JSON.stringify(change.row_pk)}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <User className="w-3 h-3" />
                        <span>{change.changed_by}</span>
                        <span className="mx-1">•</span>
                        <span className="font-mono text-[10px] text-muted-foreground/60">TX: {change.txid}</span>
                    </div>
                </div>

                <div className="flex items-center">
                    {/* Revert Button (Stop Propagation to prevent toggle) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isReverted) onRevert && onRevert(change);
                        }}
                        disabled={isReverted}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition-all ${isReverted
                            ? "bg-green-500/10 text-green-500 border border-green-500/20 cursor-default opacity-100"
                            : "opacity-0 group-hover:opacity-100 text-foreground bg-card border border-border hover:bg-accent hover:text-accent-foreground"
                            }`}
                    >
                        {isReverted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Undo2 className="w-3.5 h-3.5" />}
                        {isReverted ? "Reverted" : "Revert"}
                    </button>
                </div>
            </div>

            {/* Expanded Details */}
            {isOpen && (
                <div className="pl-14 pr-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-muted-foreground">
                            <div>
                                <span className="block text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider mb-1">Executed At</span>
                                <span className="text-foreground">{new Date(change.changed_at).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="block text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider mb-1">Transaction ID</span>
                                <span className="text-foreground">{change.txid}</span>
                            </div>
                        </div>

                        <div>
                            <span className="block text-muted-foreground/70 text-[10px] uppercase font-bold tracking-wider mb-2">Change Diff</span>
                            <DiffView oldData={change.old_data} newData={change.new_data} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
