import { db, isPostgresConfigured } from "@/db";
import { isFirebaseAdminConfigured, getAdminFirestore } from "@/lib/firebase/admin";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isPostgresConfigured()) {
      await db.execute(sql`select 1`);
      return Response.json({ ok: true, provider: "postgres" });
    }
    if (isFirebaseAdminConfigured()) {
      await getAdminFirestore().collection("_system").doc("health").get();
      return Response.json({ ok: true, provider: "firestore" });
    }
    return Response.json({ ok: false, error: "No database configured" }, { status: 500 });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
