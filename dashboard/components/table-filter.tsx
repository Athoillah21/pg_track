"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

export function TableFilter() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [term, setTerm] = useState(searchParams.get("pk") || "");

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("pk", term);
        } else {
            params.delete("pk");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    const handleClear = () => {
        setTerm("");
        const params = new URLSearchParams(searchParams);
        params.delete("pk");
        replace(`${pathname}?${params.toString()}`);
    }

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Filter by PK..."
                    value={term}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTerm(e.target.value)}
                    className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                            handleSearch();
                        }
                    }}
                />
                {term && (
                    <button
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            <button
                onClick={handleSearch}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-3"
            >
                <Search className="w-4 h-4 mr-2" />
                Filter
            </button>
        </div>
    );
}
