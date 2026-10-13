
import type {
  FeatureDefinition,
  FeatureStatus,
} from "@/features/types";

import { calendarFeature } from "@/features/calendar/manifest";
import { tasksFeature } from "@/features/tasks/manifest";
import { assistantFeature } from "@/features/assistant/manifest";
import { discordFeature } from "@/features/discord/manifest";
import { futureFeatures } from "@/features/future/manifest";

export const features: FeatureDefinition[] = [
  calendarFeature,
  tasksFeature,
  assistantFeature,
  discordFeature,
  ...futureFeatures,
];

export function getFeaturesByStatus(
  status: FeatureStatus
): FeatureDefinition[] {
  return features.filter(
    (feature) => feature.status === status
  );
}
