
import type { WorkspaceActionResult } from "./action-feedback";

export type WorkspaceSubtask = {
  id: string;
  title: string;
  isCompleted: boolean;
  position: number;
};

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;

  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  dueAt: string | null;

  // Optional temporarily for existing regression fixtures.
  subtasks?: WorkspaceSubtask[];
};

export type WorkspaceProject = {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
};

export type WorkspaceAction = (
  data: FormData
) => Promise<WorkspaceActionResult>;

export type WorkspaceActions = Record<
  | "createTask"
  | "updateTask"
  | "toggleTaskStatus"
  | "deleteTask"
  | "createProject"
  | "updateProject"
  | "setProjectArchived"
  | "deleteProject"
  | "createSubtask"
  | "updateSubtask"
  | "toggleSubtask"
  | "deleteSubtask",
  WorkspaceAction
>;

export type OnWorkspaceResult = (
  result: WorkspaceActionResult
) => void;
