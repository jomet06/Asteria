
"use server";

import { revalidatePath } from "next/cache";

import { getMyAccount } from "@/features/profile/data";
import { prisma } from "@/lib/prisma";

import { uuidPattern } from "../workspace-view";
import {
  parsePlannerDate,
  formatPlannerDate,
} from "./date";

// ========================================
// RESPONSE TYPES
// ========================================

export type PlannerActionResult =
  | {
      ok: true;
      code: "added" | "removed" | "moved" | "unchanged";
    }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "task_not_found"
        | "plan_not_found"
        | "already_planned";
    };

function success(
  code: Extract<PlannerActionResult, { ok: true }>["code"]
): PlannerActionResult {
  return { ok: true, code };
}

function failure(
  code: Extract<PlannerActionResult, { ok: false }>["code"]
): PlannerActionResult {
  return { ok: false, code };
}

// ========================================
// VALIDATION
// ========================================

function readId(
  formData: FormData,
  field: string
): string | null {
  const value = formData.get(field);

  if (
    typeof value !== "string" ||
    !uuidPattern.test(value)
  ) {
    return null;
  }

  return value;
}

function readDate(
  formData: FormData
): Date | null {
  return parsePlannerDate(
    formData.get("plannedDate")
  );
}

// ========================================
// DATABASE ERROR HELPERS
// ========================================

function isPrismaErrorCode(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

// ========================================
// REVALIDATION
// ========================================

function refreshPlanner() {
  revalidatePath("/tasks");
  revalidatePath("/tasks/planner");
  revalidatePath("/dashboard");
}

// ========================================
// ADD TASK TO DAY
// ========================================

export async function addTaskToDay(
  formData: FormData
): Promise<PlannerActionResult> {
  const { user } = await getMyAccount();

  const taskId = readId(formData, "taskId");
  const plannedDate = readDate(formData);

  if (!taskId || !plannedDate) {
    return failure("invalid_input");
  }

  // Verify Task ownership.
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ownerId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!task) {
    return failure("task_not_found");
  }

  // Check whether Task is already planned.
  const existing = await prisma.dailyPlanItem.findFirst({
    where: {
      ownerId: user.id,
      taskId,
      plannedDate,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return failure("already_planned");
  }

  // Append after the last item for that day.
  const lastPosition =
    await prisma.dailyPlanItem.aggregate({
      where: {
        ownerId: user.id,
        plannedDate,
      },
      _max: {
        position: true,
      },
    });

  const position =
    (lastPosition._max.position ?? -1) + 1;

  try {
    await prisma.dailyPlanItem.create({
      data: {
        ownerId: user.id,
        taskId,
        plannedDate,
        position,
      },
    });
  } catch (error) {
    // Concurrent requests may try to add
    // the same Task to the same date.
    if (isPrismaErrorCode(error, "P2002")) {
      return failure("already_planned");
    }

    // Parent Task may have been deleted.
    if (isPrismaErrorCode(error, "P2003")) {
      return failure("task_not_found");
    }

    throw error;
  }

  refreshPlanner();

  return success("added");
}

// ========================================
// REMOVE TASK FROM DAY
// ========================================

export async function removeTaskFromDay(
  formData: FormData
): Promise<PlannerActionResult> {
  const { user } = await getMyAccount();

  const planItemId = readId(
    formData,
    "planItemId"
  );

  if (!planItemId) {
    return failure("invalid_input");
  }

  // Remove the planning entry, not the Task.
  const result =
    await prisma.dailyPlanItem.deleteMany({
      where: {
        id: planItemId,
        ownerId: user.id,
      },
    });

  if (result.count === 0) {
    return failure("plan_not_found");
  }

  refreshPlanner();

  return success("removed");
}

// ========================================
// MOVE TASK TO ANOTHER DAY
// ========================================

export async function moveTaskToDay(
  formData: FormData
): Promise<PlannerActionResult> {
  const { user } = await getMyAccount();

  const planItemId = readId(
    formData,
    "planItemId"
  );

  const targetDate = readDate(formData);

  if (!planItemId || !targetDate) {
    return failure("invalid_input");
  }

  // Get only the current user's plan item.
  const current =
    await prisma.dailyPlanItem.findFirst({
      where: {
        id: planItemId,
        ownerId: user.id,
      },
      select: {
        id: true,
        taskId: true,
        plannedDate: true,
      },
    });

  if (!current) {
    return failure("plan_not_found");
  }

  // Nothing needs to change.
  if (
    formatPlannerDate(current.plannedDate) ===
    formatPlannerDate(targetDate)
  ) {
    return success("unchanged");
  }

  // Prevent duplicate Task entries
  // on the destination date.
  const duplicate =
    await prisma.dailyPlanItem.findFirst({
      where: {
        ownerId: user.id,
        taskId: current.taskId,
        plannedDate: targetDate,
      },
      select: {
        id: true,
      },
    });

  if (duplicate) {
    return failure("already_planned");
  }

  // Place the moved Task at the end
  // of the destination day's list.
  const lastPosition =
    await prisma.dailyPlanItem.aggregate({
      where: {
        ownerId: user.id,
        plannedDate: targetDate,
      },
      _max: {
        position: true,
      },
    });

  const position =
    (lastPosition._max.position ?? -1) + 1;

  try {
    const result =
      await prisma.dailyPlanItem.updateMany({
        where: {
          id: planItemId,
          ownerId: user.id,
        },
        data: {
          plannedDate: targetDate,
          position,
        },
      });

    if (result.count === 0) {
      return failure("plan_not_found");
    }
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return failure("already_planned");
    }

    throw error;
  }

  refreshPlanner();

  return success("moved");
}
