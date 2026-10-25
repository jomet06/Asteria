
import { Bot } from "lucide-react";
import type { FeatureDefinition } from "@/features/types";

export const assistantFeature: FeatureDefinition = {
  id: "assistant",
  title: "Asteria bot",
  description:
    "Manage activities through natural language, intelligent tools, and personalized AI memory.",
  status: "MVP",
  icon: Bot,
};
