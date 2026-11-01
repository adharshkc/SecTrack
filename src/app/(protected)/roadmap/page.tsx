import { RoadmapClient } from "@/components/roadmap-client";
import {
  CANONICAL_ROADMAP,
  ROADMAP_PHASES,
  ROADMAP_SECTIONS,
} from "@/lib/roadmap-data";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const { session } = await requirePageAuth();
  const repo = getRepository();
  const topics = await repo.listTopics(session.userId);

  return (
    <RoadmapClient
      csrfToken={session.csrfToken}
      phases={ROADMAP_PHASES}
      sections={ROADMAP_SECTIONS}
      initialTopics={topics}
      sourceUrl={CANONICAL_ROADMAP.sourceUrl}
      lastReviewedAt={CANONICAL_ROADMAP.lastReviewedAt}
    />
  );
}
