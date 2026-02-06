"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-14 h-8 bg-slate-200 rounded-full" />; // Skeleton
    }

    const isDark = theme === "dark";

    return (
        <div
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`
            w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 relative
            ${isDark ? 'bg-slate-700' : 'bg-slate-200'}
        `}
        >
            {/* Track Icons */}
            <div className="absolute inset-0 flex items-center justify-between px-2">
                <Moon className={`w-3.5 h-3.5 text-slate-800 ${isDark ? 'opacity-0' : 'opacity-50'}`} />
                <Sun className={`w-3.5 h-3.5 text-yellow-500 ${isDark ? 'opacity-50' : 'opacity-0'}`} />
            </div>

            {/* Sliding Thumb */}
            <div
                className={`
                w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 flex items-center justify-center z-10 relative
                ${isDark ? 'translate-x-6' : 'translate-x-0'}
            `}
            >
                {isDark ? (
                    <Moon className="w-3.5 h-3.5 text-slate-900" />
                ) : (
                    <Sun className="w-3.5 h-3.5 text-yellow-500" />
                )}
            </div>
        </div>
    );
}
