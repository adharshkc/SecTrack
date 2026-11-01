import { notFound } from "next/navigation";
import { TopicDetailClient } from "@/components/topic-detail-client";
import { getTodayDateKey } from "@/lib/dates";
import { getPhaseById, getSectionById } from "@/lib/roadmap-data";
import { requirePageAuth } from "@/lib/server-context";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TopicDetailPage(context: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await context.params;
  const { session, settings } = await requirePageAuth();
  const repo = getRepository();

  const topic = await repo.getTopic(session.userId, topicId);
  if (!topic) {
    notFound();
  }

  const [allTopics, sessions, events] = await Promise.all([
    repo.listTopics(session.userId),
    repo.listSessions(session.userId, { topicId }),
    repo.listCompletionEvents(session.userId, { topicId }),
  ]);

  const subtopics = allTopics.filter((t) => t.parentTopicId === topicId);
  const phase = getPhaseById(topic.phaseId);
  const section = getSectionById(topic.sectionId);
  const todayKey = getTodayDateKey(settings.timezone);

  return (
    <TopicDetailClient
      csrfToken={session.csrfToken}
      todayKey={todayKey}
      initialTopic={topic}
      initialSubtopics={subtopics}
      allTopics={allTopics}
      phaseTitle={phase?.title || topic.phaseId}
      sectionTitle={section ? `Section ${section.number}: ${section.title}` : topic.sectionId}
      initialSessions={sessions}
      initialEvents={events}
    />
  );
}
