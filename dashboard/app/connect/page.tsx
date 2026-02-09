"use client";

import { useEffect, useState, useTransition } from "react";
import { getConnections, saveConnection, deleteConnection, setActiveConnection, ConnectionConfig } from "@/actions/connection";
import { Plug, Plus, Trash2, Database, ShieldCheck, Globe, CheckCircle2, X, Key } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export default function ConnectPage() {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { addToast } = useToast();

    // Password Modal State
    const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; connectionId: string; connectionName: string }>({
        isOpen: false,
        connectionId: "",
        connectionName: ""
    });
    const [connectPassword, setConnectPassword] = useState("");
    const [connectError, setConnectError] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        host: "",
        port: 5432,
        username: "",
        password: "",
        database: "",
        ssl_mode: "disable"
    });

    const searchParams = useSearchParams();

    useEffect(() => {
        loadConnections();
        if (searchParams.get("disconnected") === "true") {
            addToast({
                type: "success",
                title: "Disconnected",
                message: "You have been successfully disconnected.",
                duration: 3000
            });
            // Clear the query param
            router.replace("/connect");
        }
    }, [searchParams]);

    async function loadConnections() {
        try {
            const data = await getConnections();
            setConnections(data);
        } catch (error) {
            console.error("Failed to load connections", error);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const res = await saveConnection(formData);
            if (res.success) {
                setFormData({ ...formData, name: "", host: "", username: "", password: "", database: "" });
                loadConnections();
                router.refresh();
                addToast({
                    type: "success",
                    title: "Connection saved",
                    message: `"${formData.name}" has been added to your connections.`
                });
            } else {
                addToast({
                    type: "error",
                    title: "Failed to save connection",
                    message: res.error
                });
            }
        });
    }

    function openPasswordModal(id: string, name: string) {
        setPasswordModal({ isOpen: true, connectionId: id, connectionName: name });
        setConnectPassword("");
        setConnectError("");
    }

    function closePasswordModal() {
        setPasswordModal({ isOpen: false, connectionId: "", connectionName: "" });
        setConnectPassword("");
        setConnectError("");
    }

    async function handleConnect() {
        if (!connectPassword) {
            setConnectError("Password is required");
            return;
        }

        startTransition(async () => {
            const res = await setActiveConnection(passwordModal.connectionId, connectPassword);
            if (res.success) {
                closePasswordModal();
                addToast({
                    type: "success",
                    title: "Connected successfully",
                    message: `Now connected to "${passwordModal.connectionName}"`
                });
                router.refresh();
                router.push('/');
            } else {
                setConnectError(res.error || "Connection failed");
                addToast({
                    type: "error",
                    title: "Connection failed",
                    message: res.error || "Unable to connect to the database",
                    duration: 8000
                });
            }
        });
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this connection?")) return;
        const res = await deleteConnection(id);
        if (res.success) loadConnections();
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Plug className="w-6 h-6 text-primary" />
                    Connection Manager
                </h1>
                <p className="text-muted-foreground">Manage your PostgreSQL database connections.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                        <h2 className="font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            New Connection
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                                <input
                                    required
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="e.g. Production DB"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground">Host</label>
                                    <input
                                        required
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="ep-xyz.aws.neon.tech"
                                        value={formData.host}
                                        onChange={e => setFormData({ ...formData, host: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Port</label>
                                    <input
                                        type="number"
                                        required
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={formData.port}
                                        onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">User</label>
                                    <input
                                        required
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Database</label>
                                    <input
                                        required
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={formData.database}
                                        onChange={e => setFormData({ ...formData, database: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Password will be securely hashed.</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">SSL Mode</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={formData.ssl_mode}
                                    onChange={e => setFormData({ ...formData, ssl_mode: e.target.value })}
                                >
                                    <option value="disable">Disable</option>
                                    <option value="require">Require</option>
                                    <option value="allow">Allow</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                            >
                                {isPending ? "Saving..." : "Save Connection"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Saved Connections
                    </h2>

                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading connections...</div>
                    ) : connections.length === 0 ? (
                        <div className="bg-muted/30 border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                            No connections saved. Add one to get started.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {connections.map(conn => (
                                <div key={conn.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground">{conn.name}</span>
                                            {conn.ssl_mode === 'require' && <ShieldCheck className="w-3 h-3 text-green-500" />}
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                            <Globe className="w-3 h-3" />
                                            {conn.host}:{conn.port}
                                            <span className="px-1">•</span>
                                            {conn.database}
                                            <span className="px-1">•</span>
                                            {conn.username}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openPasswordModal(conn.id, conn.name)}
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                            Connect
                                        </button>
                                        <button
                                            onClick={() => handleDelete(conn.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors p-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Password Modal */}
            {passwordModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePasswordModal} />
                    <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                Enter Password
                            </h3>
                            <button onClick={closePasswordModal} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Enter the password for <span className="font-semibold text-foreground">{passwordModal.connectionName}</span>
                            </p>
                            <input
                                type="password"
                                autoFocus
                                placeholder="Database password"
                                value={connectPassword}
                                onChange={e => setConnectPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            {connectError && (
                                <p className="text-sm text-destructive">{connectError}</p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 pt-2">
                            <button
                                onClick={closePasswordModal}
                                className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-md hover:bg-muted/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={isPending}
                                className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isPending ? "Connecting..." : "Connect"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
