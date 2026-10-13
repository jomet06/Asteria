
import {
  BookOpen,
  Dumbbell,
  Wallet,
  NotebookPen,
} from "lucide-react";

import type { FeatureDefinition } from "@/features/types";

export const futureFeatures: FeatureDefinition[] = [
  {
    id: "study",
    title: "Study Helper",
    description:
      "Transform learning materials into structured AI-powered study modules.",
    status: "Future",
    icon: BookOpen,
  },
  {
    id: "fitness",
    title: "Fitness Tracker",
    description:
      "Track workouts, exercise history, and fitness progress.",
    status: "Future",
    icon: Dumbbell,
  },
  {
    id: "finance",
    title: "Finance Tracker",
    description:
      "Monitor expenses, budgets, and personal financial goals.",
    status: "Future",
    icon: Wallet,
  },
  {
    id: "notes",
    title: "Notes",
    description:
      "Organize personal notes and knowledge for future AI-assisted workflows.",
    status: "Future",
    icon: NotebookPen,
  },
];
