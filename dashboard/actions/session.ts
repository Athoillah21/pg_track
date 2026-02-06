'use server'

import { cookies } from "next/headers";

export async function isConnected(): Promise<boolean> {
    const cookieStore = await cookies();
    const activeId = cookieStore.get('pg_track_active_connection')?.value;
    return !!activeId;
}
