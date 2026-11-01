import { NotesClient } from "@/components/notes-client";
import { ROADMAP_PHASES } from "@/lib/roadmap-data";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { session } = await requirePageAuth();
  const repo = getRepository();

  const [topics, reflections] = await Promise.all([
    repo.listTopics(session.userId),
    repo.listReflections(session.userId),
  ]);

  return (
    <NotesClient
      csrfToken={session.csrfToken}
      topics={topics}
      phases={ROADMAP_PHASES}
      reflections={reflections}
    />
  );
}
