"use client";

import { ChangeHistory, revertChange } from "@/actions/history";
import { CommitItem } from "./commit-item";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "./ui/confirm-modal";

interface HistoryListProps {
    initialHistory: ChangeHistory[];
}

export function HistoryList({ initialHistory }: HistoryListProps) {
    const [history, setHistory] = useState(initialHistory);
    const [isPending, startTransition] = useTransition();
    // Local state to prevent stale UI during transition
    const router = useRouter();
    const [selectedChange, setSelectedChange] = useState<ChangeHistory | null>(null);

    const handleRevertClick = (change: ChangeHistory) => {
        setSelectedChange(change);
    };

    const confirmRevert = async () => {
        if (!selectedChange) return;

        startTransition(async () => {
            const res = await revertChange(
                selectedChange.schema_name,
                selectedChange.table_name,
                selectedChange.row_pk,
                selectedChange.version
            );

            if (res.success) {
                router.refresh();
                // Optionally show a toast here instead of alert
            } else {
                alert("Revert failed: " + res.error);
            }
            setSelectedChange(null);
        });
    };

    if (history.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border border-dashed rounded-lg">
                No recent activity found.
            </div>
        );
    }

    return (
        <>
            <div className="bg-card rounded-lg border border-border shadow-sm px-6 transition-colors">
                {history.map((change) => (
                    <CommitItem
                        key={change.id}
                        change={change}
                        onRevert={handleRevertClick}
                        isReverted={change.is_reverted}
                    />
                ))}
            </div>

            <ConfirmModal
                isOpen={!!selectedChange}
                onClose={() => setSelectedChange(null)}
                onConfirm={confirmRevert}
                title="Revert Change"
                description={`Are you sure you want to revert this change on ${selectedChange?.schema_name}.${selectedChange?.table_name}? This will restore the data to its previous state.`}
                confirmText="Revert Change"
                variant="danger"
            />
        </>
    );
}
