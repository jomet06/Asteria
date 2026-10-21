
import type { WorkspaceTask } from "./workspace-types";

export type TaskSort =
  | "DEFAULT"
  | "PRIORITY"
  | "DUE_SOON"
  | "TITLE_AZ";

const priorityRank: Record<
  WorkspaceTask["priority"],
  number
> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const titleCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

export function readTaskSort(
  value: unknown
): TaskSort {
  switch (value) {
    case "PRIORITY":
    case "DUE_SOON":
    case "TITLE_AZ":
      return value;

    default:
      return "DEFAULT";
  }
}

function compareDueDates(
  a: WorkspaceTask,
  b: WorkspaceTask
): number {
  // Tasks without deadlines go last.
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;

  return a.dueAt.localeCompare(b.dueAt);
}

export function sortWorkspaceTasks<
  T extends WorkspaceTask
>(
  tasks: readonly T[],
  sort: TaskSort
): T[] {
  // Copy the array so we never mutate props.
  const result = [...tasks];

  if (sort === "DEFAULT") {
    return result;
  }

  result.sort((a, b) => {
    switch (sort) {
      case "PRIORITY": {
        const difference =
          priorityRank[b.priority] -
          priorityRank[a.priority];

        return (
          difference ||
          compareDueDates(a, b) ||
          titleCollator.compare(a.title, b.title)
        );
      }

      case "DUE_SOON":
        return (
          compareDueDates(a, b) ||
          priorityRank[b.priority] -
            priorityRank[a.priority] ||
          titleCollator.compare(a.title, b.title)
        );

      case "TITLE_AZ":
        return titleCollator.compare(
          a.title,
          b.title
        );

      default:
        return 0;
    }
  });

  return result;
}
