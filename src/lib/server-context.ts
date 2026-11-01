import "server-only";
import { redirect } from "next/navigation";
import {
  getAuthSystemStatus,
  getServerSession,
  type ActiveSession,
} from "@/lib/auth/session";
import { getRepository, syncRoadmapForUser } from "@/lib/storage";
import type { UserSettings } from "@/lib/types";

export async function requirePageAuth(): Promise<{
  session: ActiveSession;
  settings: UserSettings;
  storageProvider: "firestore" | "postgres";
}> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const repo = getRepository();
  await syncRoadmapForUser(session.userId);
  const [settings, status] = await Promise.all([
    repo.getSettings(session.userId),
    getAuthSystemStatus(),
  ]);

  return {
    session,
    settings,
    storageProvider: status.storageProvider,
  };
}
