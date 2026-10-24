import { uuidPattern } from "./workspace-view";

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

export const TASK_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

export const TASK_DIFFICULTIES = [
  "EASY",
  "NORMAL",
  "HARD",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskDifficulty = (typeof TASK_DIFFICULTIES)[number];

export const MIN_ESTIMATED_MINUTES = 1;
export const MAX_ESTIMATED_MINUTES = 1440;
export const MAX_PROGRESS = 100;
// Dependency chains longer than this are rejected so AI planning
// never has to topologically sort unbounded graphs.
export const MAX_DEPENDENCY_DEPTH = 50;

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    allowed.some((item) => item === value)
  );
}

/**
 * Parse an optional non-negative integer field.
 * Absent or "" clears to null; a present but invalid value is "invalid".
 */
function readOptionalInt(
  value: unknown,
  min: number,
  max: number
): number | null | "invalid" {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return "invalid";
  }

  if (value === "") {
    return null;
  }

  if (!/^\d{1,5}$/.test(value)) {
    return "invalid";
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return "invalid";
  }

  return parsed;
}

export type ParsedTaskFields = {
  title: string;
  description: string | null;
  projectId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  difficulty: TaskDifficulty;
  estimatedMinutes: number | null;
  progress: number;
  dependsOnTaskId: string | null;
};

export function readTaskFields(formData: FormData): ParsedTaskFields | null {
  const titleValue = formData.get("title");
  const descriptionValue = formData.get("description");
  const projectValue = formData.get("projectId");
  const statusValue = formData.get("status");
  const priorityValue = formData.get("priority");
  const dueDateValue = formData.get("dueDate");

  if (
    typeof titleValue !== "string" ||
    typeof descriptionValue !== "string" ||
    typeof projectValue !== "string" ||
    typeof dueDateValue !== "string" ||
    !isOneOf(statusValue, TASK_STATUSES) ||
    !isOneOf(priorityValue, TASK_PRIORITIES)
  ) {
    return null;
  }

  const title = titleValue.trim();
  const description = descriptionValue.trim();

  if (
    title.length < 1 ||
    title.length > 200 ||
    description.length > 2000
  ) {
    return null;
  }

  if (
    projectValue !== "" &&
    !uuidPattern.test(projectValue)
  ) {
    return null;
  }

  // Accept only YYYY-MM-DD, or an empty date.
  if (
    dueDateValue !== "" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)
  ) {
    return null;
  }

  const dueAt = dueDateValue
    ? new Date(`${dueDateValue}T00:00:00.000Z`)
    : null;

  // Reject invalid dates like 2026-02-31.
  if (
    dueAt &&
    (
      Number.isNaN(dueAt.getTime()) ||
      dueAt.toISOString().slice(0, 10) !== dueDateValue
    )
  ) {
    return null;
  }

  // Planning fields: absent (quick add) falls back to the defaults,
  // while a present but malformed value rejects the whole form.
  const difficultyValue = formData.get("difficulty");
  let difficulty: TaskDifficulty = "NORMAL";

  if (difficultyValue !== null) {
    if (!isOneOf(difficultyValue, TASK_DIFFICULTIES)) return null;
    difficulty = difficultyValue;
  }

  const estimated = readOptionalInt(
    formData.get("estimatedMinutes"),
    MIN_ESTIMATED_MINUTES,
    MAX_ESTIMATED_MINUTES
  );
  if (estimated === "invalid") return null;

  const progressValue = readOptionalInt(
    formData.get("progress"),
    0,
    MAX_PROGRESS
  );
  if (progressValue === "invalid") return null;

  const dependencyValue = formData.get("dependsOnTaskId");
  let dependsOnTaskId: string | null = null;

  if (typeof dependencyValue === "string" && dependencyValue !== "") {
    if (!uuidPattern.test(dependencyValue)) return null;
    dependsOnTaskId = dependencyValue;
  }

  return {
    title,
    description: description || null,
    projectId: projectValue || null,
    status: statusValue,
    priority: priorityValue,
    dueAt,
    difficulty,
    estimatedMinutes: estimated,
    // Completed tasks are always fully done, whatever the form sent.
    progress: statusValue === "DONE" ? MAX_PROGRESS : (progressValue ?? 0),
    dependsOnTaskId,
  };
}

/**
 * Would pointing `taskId` at `candidateId` close a loop? Walks the
 * existing dependency chain starting from the candidate.
 */
export async function dependencyChainHasCycle(
  taskId: string,
  candidateId: string,
  nextOf: (id: string) => Promise<string | null>,
  maxDepth: number = MAX_DEPENDENCY_DEPTH
): Promise<boolean> {
  let current: string | null = candidateId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (current === taskId) return true;
    current = await nextOf(current);
    if (!current) return false;
  }

  // A chain this long is indistinguishable from a loop for planning
  // purposes, so it is rejected as well.
  return true;
}
