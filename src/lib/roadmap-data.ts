import roadmapJson from "@/data/cybersecurity-roadmap.json";
import type {
  ResourceLink,
  RoadmapPhase,
  RoadmapSection,
  TopicDifficulty,
  TopicPriority,
} from "./types";

export interface SeedTopicDefinition {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  sectionId: string;
  parentTopicId: string | null;
  order: number;
  difficulty: TopicDifficulty;
  priority: TopicPriority;
  estimatedDuration: string;
  estimatedMinutes: number;
  prerequisites: string[];
  resourceLinks: ResourceLink[];
  practicalExercises: string[];
  learningObjectives: string[];
  tools: string[];
}

export interface CanonicalRoadmap {
  schemaVersion: string;
  sourceUrl: string;
  sourceTitle: string;
  lastReviewedAt: string;
  phases: RoadmapPhase[];
  sections: RoadmapSection[];
  topics: SeedTopicDefinition[];
}

export const CANONICAL_ROADMAP = roadmapJson as unknown as CanonicalRoadmap;

export const ROADMAP_PHASES: RoadmapPhase[] = CANONICAL_ROADMAP.phases;
export const ROADMAP_SECTIONS: RoadmapSection[] = CANONICAL_ROADMAP.sections;

export function getPhaseById(phaseId: string): RoadmapPhase | undefined {
  return ROADMAP_PHASES.find((p) => p.id === phaseId);
}

export function getSectionById(sectionId: string): RoadmapSection | undefined {
  return ROADMAP_SECTIONS.find((s) => s.id === sectionId);
}
