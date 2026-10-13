
import { MessageCircle } from "lucide-react";
import type { FeatureDefinition } from "@/features/types";

export const discordFeature: FeatureDefinition = {
  id: "discord",
  title: "Discord Integration",
  description:
    "Interact with Hermes through Discord and receive automatic reminders.",
  status: "MVP",
  icon: MessageCircle,
};
