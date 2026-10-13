
import { ListTodo } from "lucide-react";
import type { FeatureDefinition } from "@/features/types";

export const tasksFeature: FeatureDefinition = {
  id: "tasks",
  title: "Task & Daily Planner",
  description:
    "Organize projects, subtasks, deadlines, priorities, and AI-generated daily plans.",
  status: "MVP",
  icon: ListTodo,
};
