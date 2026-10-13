
import type { LucideIcon } from "lucide-react";

export type FeatureStatus = "MVP" | "Future";

export type FeatureDefinition = {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  icon: LucideIcon;
};
