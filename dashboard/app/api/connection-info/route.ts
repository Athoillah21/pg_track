import { cookies } from "next/headers";
import { querySystem } from "@/lib/system-db";
import { NextResponse } from "next/server";

export async function GET() {
    const cookieStore = await cookies();
    const activeId = cookieStore.get('pg_track_active_connection')?.value;

    if (!activeId) {
        return NextResponse.json(null);
    }

    try {
        const res = await querySystem('SELECT id, name, host, database FROM pg_track_connections WHERE id = $1', [activeId]);
        if (res.rowCount === 0) {
            return NextResponse.json(null);
        }
        return NextResponse.json(res.rows[0]);
    } catch (error) {
        console.error("Failed to get active connection info:", error);
        return NextResponse.json(null);
    }
}
