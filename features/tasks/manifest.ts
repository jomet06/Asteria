
import { ListTodo } from "lucide-react";
import type { FeatureDefinition } from "@/features/types";

export const tasksFeature: FeatureDefinition = {
  id: "tasks",
  title: "To-Do List",
  description:
    "Manage tasks, projects, priorities, and deadlines in one workspace.",
  status: "MVP",
  icon: ListTodo,
};
