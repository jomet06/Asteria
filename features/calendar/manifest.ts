
import { CalendarDays } from "lucide-react";
import type { FeatureDefinition } from "@/features/types";

export const calendarFeature: FeatureDefinition = {
  id: "calendar",
  title: "Calendar & Scheduling",
  description:
    "Manage recurring events, meetings, schedules, and Google Calendar synchronization.",
  status: "MVP",
  icon: CalendarDays,
};
