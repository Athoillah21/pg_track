
interface DiffProps {
    oldData: any;
    newData: any;
}

export function DiffView({ oldData, newData }: DiffProps) {
    const oldJson = oldData ? JSON.stringify(oldData, null, 2) : 'null';
    const newJson = newData ? JSON.stringify(newData, null, 2) : 'null';

    return (
        <div className="grid grid-cols-2 gap-0 border border-border rounded-md overflow-hidden text-xs font-mono bg-card">
            {/* Old Data */}
            <div className="border-r border-border">
                <div className="bg-red-50/50 dark:bg-red-900/20 px-3 py-2 border-b border-border text-red-700 dark:text-red-400 font-semibold text-[10px] uppercase tracking-wider">
                    Before
                </div>
                <div className="p-3 bg-red-50/10 dark:bg-red-900/10 overflow-x-auto">
                    <pre className="text-red-900 dark:text-red-300">{oldJson}</pre>
                </div>
            </div>

            {/* New Data */}
            <div>
                <div className="bg-green-50/50 dark:bg-green-900/20 px-3 py-2 border-b border-border text-green-700 dark:text-green-400 font-semibold text-[10px] uppercase tracking-wider">
                    After
                </div>
                <div className="p-3 bg-green-50/10 dark:bg-green-900/10 overflow-x-auto">
                    <pre className="text-green-900 dark:text-green-300">{newJson}</pre>
                </div>
            </div>
        </div>
    );
}
